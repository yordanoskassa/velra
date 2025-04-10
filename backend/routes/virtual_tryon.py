from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel
import httpx
import logging
import time
from datetime import datetime
import aiofiles
import os
import tempfile
import requests

from config import settings
from database import get_database
from models import TryonUsage

# Configure logging
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
tryon_router = APIRouter(prefix="/virtual-tryon")

# Models for the virtual try-on endpoints
class TryOnResponse(BaseModel):
    id: str
    status: str
    eta: Optional[int] = None
    result_url: Optional[Union[str, List[str]]] = None
    error: Optional[str] = None

class TryOnUsageResponse(BaseModel):
    daily_count: int
    total_count: int
    daily_limit: int = 5  # Default limit, can be overridden for premium users

# Helper function to get user ID from token
async def get_user_id(token: str = Depends(oauth2_scheme), db=Depends(get_database)):
    try:
        # This is a simplified version - you'll need to implement JWT token validation
        from jose import jwt
        
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        return user_id
    except Exception as e:
        logger.error(f"Error authenticating user: {str(e)}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Helper function to track try-on usage
async def track_tryon_usage(user_id: str, db=Depends(get_database)):
    """Track user's virtual try-on usage"""
    try:
        # Get the current usage record or create a new one
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"user_id": user_id})
        
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        if not usage:
            # Create a new usage record
            usage = {
                "user_id": user_id,
                "daily_count": 1,
                "total_count": 1,
                "last_reset": today,
                "last_used": now
            }
            await usage_collection.insert_one(usage)
        else:
            # Check if we need to reset the daily count
            last_reset = usage.get("last_reset")
            
            if isinstance(last_reset, datetime) and last_reset.date() < today.date():
                # Reset daily count if it's a new day
                await usage_collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"daily_count": 1, "last_reset": today, "last_used": now},
                     "$inc": {"total_count": 1}}
                )
            else:
                # Increment the usage counters
                await usage_collection.update_one(
                    {"user_id": user_id},
                    {"$inc": {"daily_count": 1, "total_count": 1},
                     "$set": {"last_used": now}}
                )
                
        # Also update the user engagement record if it exists
        engagement_collection = db[settings.DB_NAME]["user_engagement"]
        await engagement_collection.update_one(
            {"user_id": user_id},
            {"$set": {"last_tryon": now},
             "$inc": {"tryons_count": 1}},
            upsert=True
        )
        
        # Fetch the updated usage record
        return await usage_collection.find_one({"user_id": user_id})
        
    except Exception as e:
        logger.error(f"Error tracking try-on usage: {str(e)}")
        # Continue anyway - don't block the try-on due to usage tracking error
        return None

# Helper function to check if user has remaining try-ons
async def check_tryon_limit(user_id: str, db=Depends(get_database)):
    """Check if user has reached their daily try-on limit"""
    try:
        # Get user data to check if they're premium
        users_collection = db[settings.DB_NAME]["users"]
        user = await users_collection.find_one({"_id": user_id})
        is_premium = user.get("isPremium", False) if user else False
        
        # Set limits based on user type
        daily_limit = 50 if is_premium else 5  # Example limits
        
        # Get current usage
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"user_id": user_id})
        
        if not usage:
            # No usage record means they haven't used any try-ons today
            return True, daily_limit, 0
            
        # Check if we need to reset the daily count
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        last_reset = usage.get("last_reset")
        
        if isinstance(last_reset, datetime) and last_reset.date() < today.date():
            # It's a new day, so reset the count
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"daily_count": 0, "last_reset": today}}
            )
            return True, daily_limit, 0
            
        # Check if they've reached their limit
        daily_count = usage.get("daily_count", 0)
        if daily_count >= daily_limit:
            return False, daily_limit, daily_count
            
        return True, daily_limit, daily_count
        
    except Exception as e:
        logger.error(f"Error checking try-on limit: {str(e)}")
        # If there's an error, allow the try-on to proceed
        return True, 5, 0

@tryon_router.post("/try-async", response_model=TryOnResponse)
async def start_virtual_try_on(
    model_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
    category: str = Form("auto"),
    mode: str = Form("balanced"),
    moderation_level: str = Form("permissive"),
    cover_feet: str = Form("false"),
    adjust_hands: str = Form("true"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user_id: str = Depends(get_user_id),
    db = Depends(get_database)
):
    """Start a virtual try-on and return a prediction ID to check status"""
    
    # Check if user has remaining try-ons
    has_remaining, daily_limit, current_count = await check_tryon_limit(user_id, db)
    
    if not has_remaining:
        raise HTTPException(
            status_code=403,
            detail=f"You have reached your daily limit of {daily_limit} try-ons. Please upgrade for more."
        )
    
    if not settings.FASHN_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Virtual try-on service is not properly configured"
        )
    
    # For debugging
    logger.info(f"FASHN API KEY: {settings.FASHN_API_KEY[:5]}...")
    
    try:
        logger.info(f"Processing try-on with model image: {model_image.filename} and garment image: {garment_image.filename}")
        
        # Convert the boolean string parameters to actual booleans
        cover_feet_bool = cover_feet.lower() == "true"
        adjust_hands_bool = adjust_hands.lower() == "true"
        
        # Read file contents into memory
        model_content = await model_image.read()
        garment_content = await garment_image.read()
        
        logger.info(f"Read model image: {len(model_content)} bytes")
        logger.info(f"Read garment image: {len(garment_content)} bytes")
        
        # Create temporary files
        model_temp_path = f"/tmp/model_{time.time()}.jpg"
        garment_temp_path = f"/tmp/garment_{time.time()}.jpg"
        
        # Make sure the /tmp directory exists
        os.makedirs("/tmp", exist_ok=True)
        
        # Write the files to disk
        with open(model_temp_path, "wb") as f:
            f.write(model_content)
        
        with open(garment_temp_path, "wb") as f:
            f.write(garment_content)
            
        logger.info(f"Saved temporary files to {model_temp_path} and {garment_temp_path}")
            
        try:
            # Use Python's requests library
            import requests
            
            # Try multiple approaches to find the one that works with the FASHN API
            with open(model_temp_path, 'rb') as model_file, open(garment_temp_path, 'rb') as garment_file:
                try:
                    logger.info("Attempting API call with multipart/form-data approach")
                    
                    # First approach: Standard multipart/form-data
                    files = {
                        'model_image': ('model.jpg', model_file, 'image/jpeg'),
                        'garment_image': ('garment.jpg', garment_file, 'image/jpeg')
                    }
                    
                    data = {
                        'category': category,
                        'mode': mode,
                        'moderation_level': moderation_level,
                        'cover_feet': str(cover_feet_bool).lower(),
                        'adjust_hands': str(adjust_hands_bool).lower()
                    }
                    
                    fashn_response = requests.post(
                        "https://api.fashn.ai/v1/run",
                        files=files,
                        data=data,
                        headers={
                            "Authorization": f"Bearer {settings.FASHN_API_KEY}"
                        },
                        timeout=60
                    )
                    
                    # If first approach fails with 400, try the second approach
                    if fashn_response.status_code == 400:
                        logger.info("First approach failed. Trying with JSON payload and base64 encoded images")
                        
                        # Reset file positions
                        model_file.seek(0)
                        garment_file.seek(0)
                        
                        # Read and encode the files as base64
                        import base64
                        model_base64 = base64.b64encode(model_file.read()).decode('utf-8')
                        garment_file.seek(0)
                        garment_base64 = base64.b64encode(garment_file.read()).decode('utf-8')
                        
                        # Create JSON payload - add data URI prefix for base64 images
                        json_payload = {
                            'model_image': f"data:image/jpeg;base64,{model_base64}",
                            'garment_image': f"data:image/jpeg;base64,{garment_base64}",
                            'category': category,
                            'mode': mode,
                            'moderation_level': moderation_level,
                            'cover_feet': cover_feet_bool,
                            'adjust_hands': adjust_hands_bool
                        }
                        
                        # Make the request with JSON payload
                        fashn_response = requests.post(
                            "https://api.fashn.ai/v1/run",
                            json=json_payload,
                            headers={
                                "Authorization": f"Bearer {settings.FASHN_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            timeout=60
                        )
                        
                        # If second approach fails, try a third approach with URL parameters
                        if fashn_response.status_code == 400:
                            logger.info("Second approach failed. Trying with URL parameters")
                            
                            # Prepare multipart for files only
                            files = {
                                'model_image': ('model.jpg', open(model_temp_path, 'rb'), 'image/jpeg'),
                                'garment_image': ('garment.jpg', open(garment_temp_path, 'rb'), 'image/jpeg')
                            }
                            
                            # Add parameters to the URL
                            params = {
                                'category': category,
                                'mode': mode,
                                'moderation_level': moderation_level,
                                'cover_feet': str(cover_feet_bool).lower(),
                                'adjust_hands': str(adjust_hands_bool).lower()
                            }
                            
                            fashn_response = requests.post(
                                "https://api.fashn.ai/v1/run",
                                files=files,
                                params=params,
                                headers={
                                    "Authorization": f"Bearer {settings.FASHN_API_KEY}"
                                },
                                timeout=60
                            )
                except Exception as e:
                    logger.error(f"Error during API request: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error communicating with try-on service: {str(e)}"
                    )
            
            # Debug response
            logger.info(f"FASHN API response status: {fashn_response.status_code}")
            logger.info(f"FASHN API response headers: {fashn_response.headers}")
            logger.info(f"FASHN API response body: {fashn_response.text[:500]}...")
            
            # Check response
            if fashn_response.status_code != 200:
                logger.error(f"FASHN API error: {fashn_response.status_code}, {fashn_response.text}")
                error_detail = "Failed to start virtual try-on"
                try:
                    error_json = fashn_response.json()
                    if isinstance(error_json, dict) and 'error' in error_json:
                        error_detail = error_json['error']
                    elif isinstance(error_json, dict) and 'message' in error_json:
                        error_detail = error_json['message']
                except:
                    pass
                    
                raise HTTPException(
                    status_code=500,
                    detail=error_detail
                )
                
            # Parse the response
            result = fashn_response.json()
            
        finally:
            # Clean up temporary files
            try:
                if os.path.exists(model_temp_path):
                    os.remove(model_temp_path)
                if os.path.exists(garment_temp_path):
                    os.remove(garment_temp_path)
                logger.info("Cleaned up temporary files")
            except Exception as e:
                logger.error(f"Failed to clean up temporary files: {str(e)}")
        
        # Get prediction ID from response
        prediction_id = result.get("id")
        
        if not prediction_id:
            raise HTTPException(
                status_code=500,
                detail="Invalid response from try-on service"
            )
            
        # Track usage in the background
        background_tasks.add_task(track_tryon_usage, user_id, db)
        
        # Store the prediction in the database
        predictions_collection = db[settings.DB_NAME]["tryon_predictions"]
        await predictions_collection.insert_one({
            "id": prediction_id,
            "user_id": user_id,
            "status": "pending",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "params": {
                "model_image_name": model_image.filename,
                "garment_image_name": garment_image.filename,
                "category": category,
                "mode": mode
            }
        })
        
        return {
            "id": prediction_id,
            "status": "pending",
            "eta": result.get("eta", 15)  # Default ETA of 15 seconds if not provided
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error in virtual try-on: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start virtual try-on: {str(e)}"
        )

@tryon_router.get("/status/{prediction_id}", response_model=TryOnResponse)
async def check_try_on_status(
    prediction_id: str,
    user_id: str = Depends(get_user_id),
    db = Depends(get_database)
):
    """Check the status of a try-on prediction"""
    try:
        # First, check if we have the prediction in our database
        predictions_collection = db[settings.DB_NAME]["tryon_predictions"]
        prediction = await predictions_collection.find_one({"id": prediction_id})
        
        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="Try-on prediction not found"
            )
            
        # If the prediction belongs to a different user, prevent access
        if prediction.get("user_id") != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to access this prediction"
            )
            
        # If the prediction is already completed or failed, return from our database
        if prediction.get("status") in ["completed", "failed"]:
            return {
                "id": prediction_id,
                "status": prediction.get("status"),
                "result_url": prediction.get("result_url"),
                "error": prediction.get("error")
            }
            
        # Otherwise, check the status from the FASHN API using requests library
        try:
            import requests
            
            logger.info(f"Checking status from FASHN API for prediction: {prediction_id}")
            
            response = requests.get(
                f"https://api.fashn.ai/v1/status/{prediction_id}",
                headers={
                    "Authorization": f"Bearer {settings.FASHN_API_KEY}"
                },
                timeout=15
            )
            
            # Log the raw response for debugging
            logger.info(f"FASHN API status response: {response.status_code}, {response.text[:200]}...")
            
            if response.status_code != 200:
                logger.error(f"FASHN API status check error: {response.status_code}, {response.text}")
                # If we can't check status, don't fail - just return the stored status
                return {
                    "id": prediction_id,
                    "status": prediction.get("status", "pending"),
                    "eta": prediction.get("eta", 10)
                }
        
            # Parse the response
            result = response.json()
            
        except Exception as e:
            logger.error(f"Error making request to FASHN API: {str(e)}")
            # Return the last known status if API request fails
            return {
                "id": prediction_id,
                "status": prediction.get("status", "pending"),
                "eta": prediction.get("eta", 10)
            }
            
        # Get status from the response
        status = result.get("status", "pending")
        
        # Handle error object - convert to string if it's an object
        error = result.get("error")
        if error:
            if isinstance(error, dict):
                error_msg = error.get("message", "Unknown error")
                if "name" in error:
                    error_msg = f"{error['name']}: {error_msg}"
                error = error_msg
            # Ensure error is a string
            error = str(error)
        
        # Get the result URL
        result_url = None
        if status == "completed":
            result_url = result.get("output")
            if not result_url:
                logger.warning(f"Completed status but no output URL provided: {result}")
            # Log the result URL
            logger.info(f"Result URL from FASHN API: {result_url}")
        
        # Update our database with the latest status
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if status == "completed" and result_url:
            update_data["result_url"] = result_url
        elif status == "failed" and error:
            update_data["error"] = error
            
        # Update the database (use try/except to prevent DB errors from breaking status check)
        try:
            await predictions_collection.update_one(
                {"id": prediction_id},
                {"$set": update_data}
            )
        except Exception as db_error:
            logger.error(f"Error updating prediction in database: {str(db_error)}")
        
        # Create the response object
        response_data = {
            "id": prediction_id,
            "status": status,
            "result_url": result_url,
            "error": error if status == "failed" else None,
            "eta": result.get("eta")
        }
        
        logger.info(f"Returning status response: {response_data}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error checking try-on status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check try-on status: {str(e)}"
        )

@tryon_router.get("/usage", response_model=TryOnUsageResponse)
async def get_try_on_usage(
    user_id: str = Depends(get_user_id),
    db = Depends(get_database)
):
    """Get the user's virtual try-on usage statistics"""
    try:
        # Get user data to check if they're premium
        users_collection = db[settings.DB_NAME]["users"]
        user = await users_collection.find_one({"_id": user_id})
        is_premium = user.get("isPremium", False) if user else False
        
        # Set limits based on user type
        daily_limit = 50 if is_premium else 5  # Example limits
        
        # Get usage data
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"user_id": user_id})
        
        if not usage:
            # No usage record yet
            return {
                "daily_count": 0,
                "total_count": 0,
                "daily_limit": daily_limit
            }
            
        # Check if we need to reset the daily count
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        last_reset = usage.get("last_reset")
        
        if isinstance(last_reset, datetime) and last_reset.date() < today.date():
            # It's a new day, reset the count
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"daily_count": 0, "last_reset": today}}
            )
            return {
                "daily_count": 0,
                "total_count": usage.get("total_count", 0),
                "daily_limit": daily_limit
            }
            
        return {
            "daily_count": usage.get("daily_count", 0),
            "total_count": usage.get("total_count", 0),
            "daily_limit": daily_limit
        }
        
    except Exception as e:
        logger.error(f"Error getting try-on usage: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get try-on usage: {str(e)}"
        )

@tryon_router.post("/test", response_model=TryOnResponse)
async def test_virtual_try_on(
    model_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
    category: str = Form("auto"),
    mode: str = Form("balanced"),
    moderation_level: str = Form("permissive"),
    cover_feet: str = Form("false"),
    adjust_hands: str = Form("true"),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Test endpoint for virtual try-on that doesn't require authentication"""
    try:
        logger.info(f"Processing test try-on with model image: {model_image.filename} and garment image: {garment_image.filename}")
        
        # Convert the boolean string parameters to actual booleans
        cover_feet_bool = cover_feet.lower() == "true"
        adjust_hands_bool = adjust_hands.lower() == "true"
        
        # Read file contents into memory
        model_content = await model_image.read()
        garment_content = await garment_image.read()
        
        logger.info(f"Read model image: {len(model_content)} bytes")
        logger.info(f"Read garment image: {len(garment_content)} bytes")
        
        # Create temporary files
        model_temp_path = f"/tmp/model_{time.time()}.jpg"
        garment_temp_path = f"/tmp/garment_{time.time()}.jpg"
        
        # Make sure the /tmp directory exists
        os.makedirs("/tmp", exist_ok=True)
        
        # Write the files to disk
        with open(model_temp_path, "wb") as f:
            f.write(model_content)
        
        with open(garment_temp_path, "wb") as f:
            f.write(garment_content)
            
        logger.info(f"Saved temporary files to {model_temp_path} and {garment_temp_path}")
            
        try:
            # Use Python's requests library
            import requests
            
            # First attempt: Using files and data parameters
            with open(model_temp_path, 'rb') as model_file, open(garment_temp_path, 'rb') as garment_file:
                try:
                    logger.info("Attempting API call with multipart/form-data approach")
                    
                    # First approach: Standard multipart/form-data
                    files = {
                        'model_image': ('model.jpg', model_file, 'image/jpeg'),
                        'garment_image': ('garment.jpg', garment_file, 'image/jpeg')
                    }
                    
                    data = {
                        'category': category,
                        'mode': mode,
                        'moderation_level': moderation_level,
                        'cover_feet': str(cover_feet_bool).lower(),
                        'adjust_hands': str(adjust_hands_bool).lower()
                    }
                    
                    fashn_response = requests.post(
                        "https://api.fashn.ai/v1/run",
                        files=files,
                        data=data,
                        headers={
                            "Authorization": f"Bearer {settings.FASHN_API_KEY}"
                        },
                        timeout=60
                    )
                    
                    # If first approach fails with 400, try the second approach
                    if fashn_response.status_code == 400:
                        logger.info("First approach failed. Trying with JSON payload and base64 encoded images")
                        
                        # Reset file positions
                        model_file.seek(0)
                        garment_file.seek(0)
                        
                        # Read and encode the files as base64
                        import base64
                        model_base64 = base64.b64encode(model_file.read()).decode('utf-8')
                        garment_file.seek(0)
                        garment_base64 = base64.b64encode(garment_file.read()).decode('utf-8')
                        
                        # Create JSON payload - add data URI prefix for base64 images
                        json_payload = {
                            'model_image': f"data:image/jpeg;base64,{model_base64}",
                            'garment_image': f"data:image/jpeg;base64,{garment_base64}",
                            'category': category,
                            'mode': mode,
                            'moderation_level': moderation_level,
                            'cover_feet': cover_feet_bool,
                            'adjust_hands': adjust_hands_bool
                        }
                        
                        # Make the request with JSON payload
                        fashn_response = requests.post(
                            "https://api.fashn.ai/v1/run",
                            json=json_payload,
                            headers={
                                "Authorization": f"Bearer {settings.FASHN_API_KEY}",
                                "Content-Type": "application/json"
                            },
                            timeout=60
                        )
                        
                        # If second approach fails, try a third approach with URL parameters
                        if fashn_response.status_code == 400:
                            logger.info("Second approach failed. Trying with URL parameters")
                            
                            # Prepare multipart for files only
                            files = {
                                'model_image': ('model.jpg', open(model_temp_path, 'rb'), 'image/jpeg'),
                                'garment_image': ('garment.jpg', open(garment_temp_path, 'rb'), 'image/jpeg')
                            }
                            
                            # Add parameters to the URL
                            params = {
                                'category': category,
                                'mode': mode,
                                'moderation_level': moderation_level,
                                'cover_feet': str(cover_feet_bool).lower(),
                                'adjust_hands': str(adjust_hands_bool).lower()
                            }
                            
                            fashn_response = requests.post(
                                "https://api.fashn.ai/v1/run",
                                files=files,
                                params=params,
                                headers={
                                    "Authorization": f"Bearer {settings.FASHN_API_KEY}"
                                },
                                timeout=60
                            )
                except Exception as e:
                    logger.error(f"Error during API request: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Error communicating with try-on service: {str(e)}"
                    )
            
            # Debug response
            logger.info(f"FASHN API response status: {fashn_response.status_code}")
            logger.info(f"FASHN API response headers: {fashn_response.headers}")
            logger.info(f"FASHN API response body: {fashn_response.text[:500]}...")
            
            # Check response
            if fashn_response.status_code != 200:
                logger.error(f"FASHN API error: {fashn_response.status_code}, {fashn_response.text}")
                error_detail = "Failed to start virtual try-on"
                try:
                    error_json = fashn_response.json()
                    if isinstance(error_json, dict) and 'error' in error_json:
                        error_detail = error_json['error']
                    elif isinstance(error_json, dict) and 'message' in error_json:
                        error_detail = error_json['message']
                except:
                    pass
                    
                raise HTTPException(
                    status_code=500,
                    detail=error_detail
                )
                
            # Parse the response
            result = fashn_response.json()
            
        finally:
            # Clean up temporary files
            try:
                if os.path.exists(model_temp_path):
                    os.remove(model_temp_path)
                if os.path.exists(garment_temp_path):
                    os.remove(garment_temp_path)
                logger.info("Cleaned up temporary files")
            except Exception as e:
                logger.error(f"Failed to clean up temporary files: {str(e)}")
        
        # Get prediction ID from response
        prediction_id = result.get("id")
        
        if not prediction_id:
            raise HTTPException(
                status_code=500,
                detail="Invalid response from try-on service"
            )
            
        return {
            "id": prediction_id,
            "status": "pending",
            "eta": result.get("eta", 15)  # Default ETA of 15 seconds if not provided
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error in test try-on: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start test try-on: {str(e)}"
        )

@tryon_router.get("/test-status/{prediction_id}", response_model=TryOnResponse)
async def test_try_on_status(prediction_id: str):
    """Test endpoint to check the status of a try-on prediction without authentication"""
    try:
        # Check the status from the FASHN API
        import requests
        
        try:
            logger.info(f"Checking test status from FASHN API for prediction: {prediction_id}")
            
            response = requests.get(
                f"https://api.fashn.ai/v1/status/{prediction_id}",
                headers={
                    "Authorization": f"Bearer {settings.FASHN_API_KEY}"
                },
                timeout=15
            )
            
            # Log the raw response for debugging
            logger.info(f"FASHN API test status response: {response.status_code}, {response.text[:200]}...")
                
            if response.status_code != 200:
                logger.error(f"FASHN API test status check error: {response.status_code}, {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Failed to check try-on status: {response.text}"
                )
        except requests.RequestException as req_error:
            logger.error(f"Request error checking status: {str(req_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error connecting to try-on service: {str(req_error)}"
            )
            
        # Parse the response
        try:
            result = response.json()
        except ValueError as json_error:
            logger.error(f"Invalid JSON in FASHN API response: {response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Invalid response from try-on service: {str(json_error)}"
            )
            
        status = result.get("status", "pending")
        
        # Handle error object - convert complex error objects to string
        error = result.get("error")
        if error:
            if isinstance(error, dict):
                error_msg = error.get("message", "Unknown error")
                if "name" in error:
                    error_msg = f"{error['name']}: {error_msg}"
                error = error_msg
            # Ensure error is a string
            error = str(error)
            
        # Get result URL
        result_url = None
        if status == "completed":
            result_url = result.get("output")
            if not result_url:
                logger.warning(f"Completed status but no output URL provided: {result}")
            # Log the result URL
            logger.info(f"Result URL from FASHN API: {result_url}")
        
        # Create response
        response_data = {
            "id": prediction_id,
            "status": status,
            "result_url": result_url,
            "error": error,
            "eta": result.get("eta")
        }
        
        logger.info(f"Returning test status response: {response_data}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error checking test try-on status: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check test try-on status: {str(e)}"
        ) 