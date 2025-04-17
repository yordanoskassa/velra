from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
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
from models import TryonUsage, DeviceBasedRequest

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

class TryOnCountsModel(BaseModel):
    daily_count: int = 0
    monthly_count: int = 0
    total_count: int = 0

class TryOnUsageResponse(BaseModel):
    daily_count: int
    monthly_count: Optional[int] = 0
    total_count: int
    daily_limit: int = 1     # Default limit for free users, 1 per day
    monthly_limit: int = 40  # Default limit, can be overridden for premium users
    counts: Optional[TryOnCountsModel] = None

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
async def track_tryon_usage(user_id: str, is_subscribed: bool = False, db=Depends(get_database)):
    """Track user's virtual try-on usage with simplified logic"""
    try:
        # Get the current usage record or create a new one
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"user_id": user_id})
        
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        if not usage:
            # Create a new usage record
            usage = {
                "user_id": user_id,
                "daily_count": 1,
                "monthly_count": 1,
                "total_count": 1,
                "last_reset_daily": today,
                "last_reset_monthly": first_of_month,
                "last_used": now,
                "is_subscribed": is_subscribed
            }
            await usage_collection.insert_one(usage)
            
            # Also create user engagement record
            engagement_collection = db[settings.DB_NAME]["user_engagement"]
            await engagement_collection.update_one(
                {"user_id": user_id},
                {"$set": {"last_tryon": now},
                 "$inc": {"tryons_count": 1}},
                upsert=True
            )
            
            return usage
        
        # CRITICAL CHECK: Make sure we're not exceeding limits
        # Get current counts
        daily_count = usage.get("daily_count", 0)
        monthly_count = usage.get("monthly_count", 0)
        
        # Reset counters if needed
        update_fields = {"last_used": now, "is_subscribed": is_subscribed}
        needs_update = False
        
        # Reset daily count if it's a new day
        last_reset_daily = usage.get("last_reset_daily", today)
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            daily_count = 0
            update_fields["daily_count"] = 0
            update_fields["last_reset_daily"] = today
            needs_update = True
        
        # Reset monthly count if it's a new month
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            monthly_count = 0
            update_fields["monthly_count"] = 0
            update_fields["last_reset_monthly"] = first_of_month
            needs_update = True
            
        # Update resets if needed
        if needs_update:
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": update_fields}
            )
        
        # Our simplified business logic:
        # 1. For non-subscribers: Only 1 try-on per day
        # 2. Both subscribers and non-subscribers: Max 40 try-ons per month
        
        # Check monthly limit (applies to all users)
        if monthly_count >= 40:
            logger.warning(f"User {user_id} has reached monthly limit: {monthly_count}/40")
            return usage  # Don't increment
            
        # Check daily limit for free users
        if not is_subscribed and daily_count >= 1:
            logger.warning(f"Non-subscribed user {user_id} has reached daily limit: {daily_count}/1")
            return usage  # Don't increment
        
        # If we get here, increment the counters
        increment = {
            "daily_count": 1,
            "monthly_count": 1,
            "total_count": 1
        }
        
        await usage_collection.update_one(
            {"user_id": user_id},
            {"$inc": increment}
        )
        
        # Also update the user engagement record
        engagement_collection = db[settings.DB_NAME]["user_engagement"]
        await engagement_collection.update_one(
            {"user_id": user_id},
            {"$set": {"last_tryon": now},
             "$inc": {"tryons_count": 1}},
            upsert=True
        )
        
        # Get the updated usage record
        updated_usage = await usage_collection.find_one({"user_id": user_id})
        logger.info(f"Updated usage for user {user_id}: daily={updated_usage.get('daily_count', 0)}, monthly={updated_usage.get('monthly_count', 0)}/40")
        return updated_usage
        
    except Exception as e:
        logger.error(f"Error tracking try-on usage: {str(e)}", exc_info=True)
        # Continue anyway - don't block the try-on due to usage tracking error
        return None

# Helper function to check if user has remaining try-ons
async def check_tryon_limit(user_id: str, db=Depends(get_database)):
    """Check if user has reached their daily or monthly try-on limit"""
    try:
        # Get user data to check if they're premium
        users_collection = db[settings.DB_NAME]["users"]
        user = await users_collection.find_one({"_id": user_id})
        is_premium = user.get("isPremium", False) if user else False
        
        # Set limits based on user type
        daily_limit = 40 if is_premium else 1   # PRO users don't have daily limit, free users get 1/day
        monthly_limit = 40  # Both free and PRO users have 40/month limit
        
        # Get current usage
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"user_id": user_id})
        
        if not usage:
            # No usage record means they haven't used any try-ons today
            return True, daily_limit, monthly_limit, 0, 0, None
            
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Check if we need to reset the daily count
        last_reset_daily = usage.get("last_reset_daily", usage.get("last_reset", now))
        daily_count = usage.get("daily_count", 0)
        
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            # It's a new day, so reset the count
            daily_count = 0
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"daily_count": 0, "last_reset_daily": today}}
            )
            
        # Check if we need to reset the monthly count    
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        monthly_count = usage.get("monthly_count", 0)
        
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            # It's a new month, so reset the count
            monthly_count = 0
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"monthly_count": 0, "last_reset_monthly": first_of_month}}
            )
            
        # Check if they've reached their daily limit (only for free users)
        if not is_premium and daily_count >= daily_limit:
            return False, daily_limit, monthly_limit, daily_count, monthly_count, "DAILY_LIMIT_REACHED"
            
        # Check if they've reached their monthly limit (for all users)
        if monthly_count >= monthly_limit:
            return False, daily_limit, monthly_limit, daily_count, monthly_count, "MONTHLY_LIMIT_REACHED"
            
        return True, daily_limit, monthly_limit, daily_count, monthly_count, None
        
    except Exception as e:
        logger.error(f"Error checking try-on limit: {str(e)}")
        # If there's an error, allow the try-on to proceed
        return True, 40, 40, 0, 0, None

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
    
    # Get user subscription status and usage data
    usage_collection = db[settings.DB_NAME]["tryon_usage"]
    usage = await usage_collection.find_one({"user_id": user_id})
    
    # Check if user exists in subscription database
    subscription_collection = db[settings.DB_NAME]["subscriptions"]
    subscription = await subscription_collection.find_one({"user_id": user_id})
    is_subscribed = subscription is not None and subscription.get("status", "") == "active"
    
    # Simple usage logic
    if usage:
        daily_count = usage.get("daily_count", 0)
        monthly_count = usage.get("monthly_count", 0)
        
        # Reset monthly count if it's a new month
        now = datetime.utcnow()
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            monthly_count = 0
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"monthly_count": 0, "last_reset_monthly": first_of_month}}
            )
        
        # 1. If not subscribed and daily count >= 1, show paywall
        if not is_subscribed and daily_count >= 1:
            raise HTTPException(
                status_code=403,
                detail="Upgrade to PRO for unlimited daily try-ons!"
            )
        
        # 2. If monthly count >= 40, show limit message (for both free and pro)
        if monthly_count >= 40:
            raise HTTPException(
                status_code=403,
                detail="You've reached your monthly limit. Try again next month!"
            )
            
        logger.info(f"User {user_id} usage: daily={daily_count}, monthly={monthly_count}/40, subscribed={is_subscribed}")
    else:
        # First time user, we'll create usage record after the try-on
        daily_count = 0
        monthly_count = 0
    
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
            
        # We need to track device usage directly in the database BEFORE returning the response
        # This ensures the count is immediately updated and prevents exceeding the limit
        if device_id:
            try:
                # Get current usage data
                usage_collection = db[settings.DB_NAME]["tryon_usage"]
                usage = await usage_collection.find_one({"device_id": device_id})
                
                now = datetime.utcnow()
                today = now.replace(hour=0, minute=0, second=0, microsecond=0)
                first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                
                if not usage:
                    # Create new usage record
                    new_usage = {
                        "device_id": device_id,
                        "user_id": None,  # Anonymous user
                        "daily_count": 1,
                        "monthly_count": 1,
                        "total_count": 1,
                        "last_reset_daily": today,
                        "last_reset_monthly": first_of_month,
                        "last_used": now
                    }
                    await usage_collection.insert_one(new_usage)
                    logger.info(f"Created new usage record for device {device_id}")
                else:
                    # Update existing usage record
                    update_fields = {"last_used": now}
                    increment_fields = {}
                    
                    # Check if we need to reset counts
                    last_reset_daily = usage.get("last_reset_daily", usage.get("last_reset", now))
                    if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
                        update_fields["daily_count"] = 1
                        update_fields["last_reset_daily"] = today
                    else:
                        # CRITICAL: Increment by exactly 1
                        increment_fields["daily_count"] = 1
                    
                    last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
                    if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
                        update_fields["monthly_count"] = 1
                        update_fields["last_reset_monthly"] = first_of_month
                    else:
                        # CRITICAL: Increment by exactly 1
                        increment_fields["monthly_count"] = 1
                    
                    # Always increment total count by exactly 1
                    increment_fields["total_count"] = 1
                    
                    # Update the record
                    if update_fields and increment_fields:
                        await usage_collection.update_one(
                            {"device_id": device_id},
                            {
                                "$set": update_fields,
                                "$inc": increment_fields
                            }
                        )
                    elif update_fields:
                        await usage_collection.update_one(
                            {"device_id": device_id},
                            {"$set": update_fields}
                        )
                    elif increment_fields:
                        await usage_collection.update_one(
                            {"device_id": device_id},
                            {"$inc": increment_fields}
                        )
                    
                    logger.info(f"Updated usage record for device {device_id}")
                    
                    # Get the updated counts to verify
                    updated_usage = await usage_collection.find_one({"device_id": device_id})
                    if updated_usage:
                        logger.info(f"Updated counts: daily={updated_usage.get('daily_count', 0)}, monthly={updated_usage.get('monthly_count', 0)}")
                        
                        # CRITICAL: Double-check if we've reached the monthly limit AFTER incrementing
                        if updated_usage.get('monthly_count', 0) > 40:
                            logger.error(f"CRITICAL: Device {device_id} has exceeded monthly limit: {updated_usage.get('monthly_count', 0)}/40")
                            # Force update to exactly 40 to prevent further exceeding
                            await usage_collection.update_one(
                                {"device_id": device_id},
                                {"$set": {"monthly_count": 40}}
                            )
            except Exception as e:
                logger.error(f"Error tracking device usage: {str(e)}", exc_info=True)
        
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
        daily_limit = 40 if is_premium else 1  # PRO users don't have daily limit, free users get 1/day
        monthly_limit = 40  # Both free and PRO users have 40/month limit
        
        # Get usage data
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"user_id": user_id})
        
        if not usage:
            # No usage record yet
            return {
                "daily_count": 0,
                "monthly_count": 0,
                "total_count": 0,
                "daily_limit": daily_limit,
                "monthly_limit": monthly_limit
            }
            
        # Check if we need to reset the daily count
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        last_reset_daily = usage.get("last_reset_daily", usage.get("last_reset", now))
        monthly_count = usage.get("monthly_count", 0)
        
        # Update schema if old format is found (backward compatibility)
        if "last_reset_daily" not in usage and "last_reset" in usage:
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"last_reset_daily": usage["last_reset"]}}
            )
        
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            # It's a new day, reset the count
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"daily_count": 0, "last_reset_daily": today}}
            )
            return {
                "daily_count": 0,
                "monthly_count": monthly_count,
                "total_count": usage.get("total_count", 0),
                "daily_limit": daily_limit,
                "monthly_limit": monthly_limit
            }
        
        # Check if we need to reset the monthly count
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            # It's a new month, reset the count
            monthly_count = 0
            await usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {"monthly_count": 0, "last_reset_monthly": first_of_month}}
            )
            
        return {
            "daily_count": usage.get("daily_count", 0),
            "monthly_count": monthly_count,
            "total_count": usage.get("total_count", 0),
            "daily_limit": daily_limit,
            "monthly_limit": monthly_limit
        }
        
    except Exception as e:
        logger.error(f"Error getting try-on usage: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get try-on usage: {str(e)}"
        )

@tryon_router.post("/device-usage", response_model=TryOnUsageResponse)
async def track_device_try_on_usage(
    device_data: DeviceBasedRequest,
    db = Depends(get_database)
):
    """Track and get try-on usage for a specific device without requiring authentication"""
    try:
        # Get device information
        device_id = device_data.device_id
        check_only = device_data.check_only
        is_subscribed = device_data.is_subscribed
        
        logger.info(f"Tracking try-on usage for device: {device_id}, check_only: {check_only}, is_subscribed: {is_subscribed}")
        
        # Get usage data
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"device_id": device_id})
        
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # If no usage record exists, create a new one
        if not usage:
            logger.info(f"No usage record found for device {device_id} - creating new record")
            
            # For check_only mode, don't create a record yet
            if check_only:
                logger.info("Check-only mode - not creating record")
                return {
                    "daily_count": 0,
                    "monthly_count": 0,
                    "total_count": 0,
                    "daily_limit": 1 if not is_subscribed else 40,
                    "monthly_limit": 40,
                    "counts": {
                        "daily_count": 0,
                        "monthly_count": 0,
                        "total_count": 0
                    }
                }
            
            # Create a new usage record with counts of 1
            new_usage = {
                "device_id": device_id,
                "user_id": None,  # Anonymous user
                "daily_count": 1,
                "monthly_count": 1,
                "total_count": 1,
                "last_reset_daily": today,
                "last_reset_monthly": first_of_month,
                "last_used": now,
                "app_version": device_data.app_version,
                "device_model": device_data.device_model,
                "os_version": device_data.os_version
            }
            
            await usage_collection.insert_one(new_usage)
            logger.info(f"Created new usage record with counts of 1 for device {device_id}")
            
            # Set daily limit based on subscription status
            daily_limit = 40 if is_subscribed else 1  # PRO users get 40/day, free users get 1/day
            
            return {
                "daily_count": 1,
                "monthly_count": 1,
                "total_count": 1,
                "daily_limit": daily_limit,
                "monthly_limit": 40,
                "counts": {
                    "daily_count": 1,
                    "monthly_count": 1,
                    "total_count": 1
                }
            }
            
        # Get current counts and check if we need to reset based on date
        daily_count = usage.get("daily_count", 0)
        monthly_count = usage.get("monthly_count", 0)
        total_count = usage.get("total_count", 0)
        
        # Check if we need to reset daily count (new day)
        last_reset_daily = usage.get("last_reset_daily", today)
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            logger.info(f"Resetting daily count for device {device_id} (new day)")
            daily_count = 0
            await usage_collection.update_one(
                {"device_id": device_id},
                {"$set": {"daily_count": 0, "last_reset_daily": today}}
            )
        
        # Check if we need to reset monthly count (new month)
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            logger.info(f"Resetting monthly count for device {device_id} (new month)")
            monthly_count = 0
            await usage_collection.update_one(
                {"device_id": device_id},
                {"$set": {"monthly_count": 0, "last_reset_monthly": first_of_month}}
            )
        
        # Set limits based on subscription status
        daily_limit = 40 if is_subscribed else 1  # PRO users get 40/day, free users get 1/day
        monthly_limit = 40  # Both free and PRO users have 40/month limit
        
        # CRITICAL CHECKS: If check_only is true, just return the current counts without incrementing
        if check_only:
            logger.info(f"Check-only mode - returning current counts without incrementing: daily={daily_count}/{daily_limit}, monthly={monthly_count}/{monthly_limit}")
            return {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": total_count,
                "daily_limit": daily_limit,
                "monthly_limit": monthly_limit,
                "counts": {
                    "daily_count": daily_count,
                    "monthly_count": monthly_count,
                    "total_count": total_count
                }
            }
            
        # Now we need to check limits and possibly increment
        
        # First check if they've reached the monthly limit (for both free and pro)
        if monthly_count >= monthly_limit:
            logger.warning(f"Device {device_id} has reached monthly limit: {monthly_count}/{monthly_limit}")
            return {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": total_count,
                "daily_limit": daily_limit,
                "monthly_limit": monthly_limit,
                "counts": {
                    "daily_count": daily_count,
                    "monthly_count": monthly_count,
                    "total_count": total_count
                },
                "error": "MONTHLY_LIMIT_REACHED",
                "message": "You've reached your monthly limit. Try again next month!"
            }
            
        # Then check daily limit (only for free users)
        if not is_subscribed and daily_count >= daily_limit:
            logger.warning(f"Free user device {device_id} has reached daily limit: {daily_count}/{daily_limit}")
            return {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": total_count,
                "daily_limit": daily_limit,
                "monthly_limit": monthly_limit,
                "counts": {
                    "daily_count": daily_count,
                    "monthly_count": monthly_count,
                    "total_count": total_count
                },
                "error": "DAILY_LIMIT_REACHED",
                "message": "Upgrade to PRO for unlimited daily try-ons!"
            }
            
        # If we get here, we can increment the counts
        logger.info(f"Incrementing usage counts for device {device_id}")
        update_fields = {"last_used": now}
        increment_fields = {
            "daily_count": 1,
            "monthly_count": 1,
            "total_count": 1
        }
        
        # Update device info if provided
        if device_data.app_version:
            update_fields["app_version"] = device_data.app_version
        if device_data.device_model:
            update_fields["device_model"] = device_data.device_model
        if device_data.os_version:
            update_fields["os_version"] = device_data.os_version
            
        # Update the record
        await usage_collection.update_one(
            {"device_id": device_id},
            {
                "$set": update_fields,
                "$inc": increment_fields
            }
        )
        
        # Get the updated record to return accurate counts
        updated_usage = await usage_collection.find_one({"device_id": device_id})
        if updated_usage:
            updated_daily = updated_usage.get("daily_count", daily_count + 1)
            updated_monthly = updated_usage.get("monthly_count", monthly_count + 1)
            updated_total = updated_usage.get("total_count", total_count + 1)
            
            logger.info(f"Updated counts for device {device_id}: daily={updated_daily}/{daily_limit}, monthly={updated_monthly}/{monthly_limit}")
            
            return {
                "daily_count": updated_daily,
                "monthly_count": updated_monthly,
                "total_count": updated_total,
                "daily_limit": daily_limit,
                "monthly_limit": monthly_limit,
                "counts": {
                    "daily_count": updated_daily,
                    "monthly_count": updated_monthly,
                    "total_count": updated_total
                }
            }
        
        # Fallback if we couldn't get the updated record
        incremented_daily = daily_count + 1
        incremented_monthly = monthly_count + 1 
        incremented_total = total_count + 1
            
        return {
            "daily_count": incremented_daily,
            "monthly_count": incremented_monthly,
            "total_count": incremented_total,
            "daily_limit": daily_limit,
            "monthly_limit": monthly_limit,
            "counts": {
                "daily_count": incremented_daily,
                "monthly_count": incremented_monthly,
                "total_count": incremented_total
            }
        }
        
    except Exception as e:
        logger.error(f"Error tracking device try-on usage: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to track device try-on usage: {str(e)}"
        )

# Helper function to check device try-on limits directly from database
async def check_device_tryon_limits(device_id: str, is_subscribed: bool, db=None):
    """Check if a device has reached its monthly try-on limit directly from the database"""
    try:
        if not db:
            db = await get_database()
            
        logger.info(f"CRITICAL DATABASE CHECK: Checking try-on limits for device: {device_id}")
        
        # Get usage data directly from database
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"device_id": device_id})
        
        # If there's no usage record, this is their first try-on - let them try!
        if not usage:
            logger.info(f"No usage record found for device {device_id} - allowing first try")
            daily_limit = 40 if is_subscribed else 1
            monthly_limit = 40
            return True, daily_limit, monthly_limit, 0, 0, None
            
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Check if we need to reset the daily count
        last_reset_daily = usage.get("last_reset_daily", usage.get("last_reset", now))
        daily_count = usage.get("daily_count", 0)
        
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            # It's a new day, so reset the count
            daily_count = 0
            await usage_collection.update_one(
                {"device_id": device_id},
                {"$set": {"daily_count": 0, "last_reset_daily": today}}
            )
            
        # Check if we need to reset the monthly count    
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        monthly_count = usage.get("monthly_count", 0)
        
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            # It's a new month, so reset the count
            monthly_count = 0
            await usage_collection.update_one(
                {"device_id": device_id},
                {"$set": {"monthly_count": 0, "last_reset_monthly": first_of_month}}
            )
        
        # Set limits based on subscription status
        daily_limit = 40 if is_subscribed else 1   # PRO users get 40/day, free users get 1/day
        monthly_limit = 40  # Both free and PRO users have 40/month limit
        
        logger.info(f"Device {device_id} usage: daily={daily_count}/{daily_limit}, monthly={monthly_count}/{monthly_limit}")
        
        # Check if they've reached their daily limit (only for free users)
        if not is_subscribed and daily_count >= daily_limit:
            logger.warning(f"Device {device_id} has reached daily limit: {daily_count}/{daily_limit}")
            return False, daily_limit, monthly_limit, daily_count, monthly_count, "DAILY_LIMIT_REACHED"
            
        # CRITICAL CHECK: Check if they've reached their monthly limit (for all users)
        if monthly_count >= monthly_limit:
            logger.warning(f"Device {device_id} has reached monthly limit: {monthly_count}/{monthly_limit}")
            return False, daily_limit, monthly_limit, daily_count, monthly_count, "MONTHLY_LIMIT_REACHED"
            
        return True, daily_limit, monthly_limit, daily_count, monthly_count, None
        
    except Exception as e:
        logger.error(f"Error checking device try-on limit: {str(e)}", exc_info=True)
        # If there's an error, allow the try-on to proceed
        return True, 40, 40, 0, 0, None

@tryon_router.post("/usage-check/{device_id}")
async def check_device_usage(device_id: str, db = Depends(get_database)):
    """Direct endpoint to check a device's try-on usage from the database"""
    try:
        logger.info(f"Direct usage check for device: {device_id}")
        
        # Get usage data directly from database
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"device_id": device_id})
        
        if not usage:
            return {"counts": {"daily_count": 0, "monthly_count": 0, "total_count": 0}}
        
        # Check if counts need to be reset
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        daily_count = usage.get("daily_count", 0)
        monthly_count = usage.get("monthly_count", 0)
        total_count = usage.get("total_count", 0)
        
        # Check if daily count needs reset
        last_reset_daily = usage.get("last_reset_daily", usage.get("last_reset", now))
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            daily_count = 0
        
        # Check if monthly count needs reset
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            monthly_count = 0
        
        return {
            "counts": {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": total_count
            }
        }
    except Exception as e:
        logger.error(f"Error checking device usage: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error checking device usage")

@tryon_router.get("/usage-check/{device_id}", response_model=TryOnUsageResponse)
@tryon_router.get("/virtual-tryon/usage-check/{device_id}", response_model=TryOnUsageResponse)
async def check_device_usage(device_id: str, force_db: bool = False, db = Depends(get_database)):
    """Check a device's virtual try-on usage from the database"""
    try:
        # Get usage data directly from database
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"device_id": device_id})
        
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        if not usage:
            # No usage record yet - this is a new user
            logger.info(f"No usage record for device {device_id} - new user")
            return {
                "daily_count": 0,
                "monthly_count": 0,
                "total_count": 0,
                "daily_limit": 1,  # Default for free users
                "monthly_limit": 40,
                "counts": {
                    "daily_count": 0,
                    "monthly_count": 0,
                    "total_count": 0
                }
            }
            
        # Check if we need to reset the daily/monthly counts
        last_reset_daily = usage.get("last_reset_daily", today)
        daily_count = usage.get("daily_count", 0)
        
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            # It's a new day, so the daily count should be reset
            daily_count = 0
            # Only update the database if force_db is true
            if force_db:
                await usage_collection.update_one(
                    {"device_id": device_id},
                    {"$set": {"daily_count": 0, "last_reset_daily": today}}
                )
            
        # Check monthly reset
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        monthly_count = usage.get("monthly_count", 0)
        
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            # It's a new month, so the monthly count should be reset
            monthly_count = 0
            # Only update the database if force_db is true
            if force_db:
                await usage_collection.update_one(
                    {"device_id": device_id},
                    {"$set": {"monthly_count": 0, "last_reset_monthly": first_of_month}}
                )
            
        # Include both the root level counts and nested counts that frontend expects
        return {
            "daily_count": daily_count,
            "monthly_count": monthly_count,
            "total_count": usage.get("total_count", 0),
            "daily_limit": 1,  # Default for free users
            "monthly_limit": 40,
            "counts": {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": usage.get("total_count", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error checking device usage: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check device usage: {str(e)}"
        )

@tryon_router.post("/test", response_model=TryOnResponse)
async def test_virtual_try_on(
    request: Request,
    model_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
    category: str = Form("auto"),
    mode: str = Form("balanced"),
    moderation_level: str = Form("permissive"),
    cover_feet: str = Form("false"),
    adjust_hands: str = Form("true"),
    skip_usage_tracking: str = Form("false"),
    device_id: Optional[str] = Form(None),
    is_subscribed: Optional[str] = Form("false"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db = Depends(get_database)
):
    """Test endpoint for virtual try-on that doesn't require authentication"""
    
    try:
        # Extract device ID from multiple sources
        device_id_value = device_id  # First priority: explicit form parameter
        is_subscribed_value = is_subscribed.lower() == 'true'
        
        # If not found in form data, try headers
        if not device_id_value and request and request.headers:
            device_id_value = request.headers.get('X-Device-Id')
            is_subscribed_str = request.headers.get('X-Is-Subscribed', 'false')
            is_subscribed_value = is_subscribed_str.lower() == 'true'
        
        # If still not found, try query parameters
        if not device_id_value:
            try:
                device_id_value = request.query_params.get('device_id')
                is_subscribed_str = request.query_params.get('is_subscribed', 'false')
                is_subscribed_value = is_subscribed_str.lower() == 'true'
            except Exception as e:
                logger.error(f"Error extracting device ID from query params: {str(e)}")
        
        # Log the device ID and skip_usage_tracking status
        skip_tracking = skip_usage_tracking.lower() == 'true'
        logger.info(f"Device ID: {device_id_value}, Is Subscribed: {is_subscribed_value}, Skip tracking: {skip_tracking}")
        
        # Only check limits if we have a device ID and aren't skipping tracking
        # This allows the front-end to handle usage tracking separately via the device-usage endpoint
        # But we'll keep the option to track it here for backward compatibility
        if device_id_value and not skip_tracking:
            # Check if the device has reached its limits
            has_remaining, daily_limit, monthly_limit, daily_count, monthly_count, error = await check_device_tryon_limits(
                device_id_value, is_subscribed_value, db
            )
            
            if not has_remaining:
                if error == "MONTHLY_LIMIT_REACHED":
                    raise HTTPException(
                        status_code=403,
                        detail="You've reached your monthly limit. Try again next month!"
                    )
                elif error == "DAILY_LIMIT_REACHED":
                    raise HTTPException(
                        status_code=403,
                        detail="Upgrade to PRO for unlimited daily try-ons!"
                    )
                    
            logger.info(f"Device {device_id_value} usage: daily={daily_count}/{daily_limit}, monthly={monthly_count}/{monthly_limit}")
        
        # Convert boolean string parameters to booleans
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
            
        # Only track usage if skip_tracking is false and we have a device ID
        # This logic is now handled by the front-end via the device-usage endpoint
        # But we'll keep the option to track it here for backward compatibility
        if device_id_value and not skip_tracking:
            # Track device usage directly in the database
            try:
                # Get current usage data
                usage_collection = db[settings.DB_NAME]["tryon_usage"]
                usage = await usage_collection.find_one({"device_id": device_id_value})
                
                now = datetime.utcnow()
                today = now.replace(hour=0, minute=0, second=0, microsecond=0)
                first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                
                if not usage:
                    # Create new usage record
                    new_usage = {
                        "device_id": device_id_value,
                        "user_id": None,  # Anonymous user
                        "daily_count": 1,
                        "monthly_count": 1,
                        "total_count": 1,
                        "last_reset_daily": today,
                        "last_reset_monthly": first_of_month,
                        "last_used": now
                    }
                    await usage_collection.insert_one(new_usage)
                    logger.info(f"Created new usage record for device {device_id_value}")
                else:
                    # Update existing usage record
                    update_fields = {"last_used": now}
                    increment_fields = {}
                    
                    # Check if we need to reset counts
                    last_reset_daily = usage.get("last_reset_daily", usage.get("last_reset", now))
                    if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
                        update_fields["daily_count"] = 1
                        update_fields["last_reset_daily"] = today
                    else:
                        # CRITICAL: Increment by exactly 1
                        increment_fields["daily_count"] = 1
                    
                    last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
                    if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
                        update_fields["monthly_count"] = 1
                        update_fields["last_reset_monthly"] = first_of_month
                    else:
                        # CRITICAL: Increment by exactly 1
                        increment_fields["monthly_count"] = 1
                    
                    # Always increment total count by exactly 1
                    increment_fields["total_count"] = 1
                    
                    # Update the record
                    if update_fields and increment_fields:
                        await usage_collection.update_one(
                            {"device_id": device_id_value},
                            {
                                "$set": update_fields,
                                "$inc": increment_fields
                            }
                        )
                    elif update_fields:
                        await usage_collection.update_one(
                            {"device_id": device_id_value},
                            {"$set": update_fields}
                        )
                    elif increment_fields:
                        await usage_collection.update_one(
                            {"device_id": device_id_value},
                            {"$inc": increment_fields}
                        )
                    
                    logger.info(f"Updated usage record for device {device_id_value}")
                    
                    # Get the updated counts to verify
                    updated_usage = await usage_collection.find_one({"device_id": device_id_value})
                    if updated_usage:
                        logger.info(f"Updated counts: daily={updated_usage.get('daily_count', 0)}, monthly={updated_usage.get('monthly_count', 0)}")
                        
                        # CRITICAL: Double-check if we've reached the monthly limit AFTER incrementing
                        if updated_usage.get('monthly_count', 0) >= 40:
                            logger.error(f"CRITICAL: Device {device_id_value} has reached monthly limit: {updated_usage.get('monthly_count', 0)}/40")
                            # Force update to exactly 40 to prevent further exceeding
                            await usage_collection.update_one(
                                {"device_id": device_id_value},
                                {"$set": {"monthly_count": 40}}
                            )
            except Exception as e:
                logger.error(f"Error tracking device usage: {str(e)}", exc_info=True)
        
        # Store the prediction in the database
        predictions_collection = db[settings.DB_NAME]["tryon_predictions"]
        await predictions_collection.insert_one({
            "id": prediction_id,
            "device_id": device_id_value,  # Store the device ID
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

@tryon_router.post("/sync-stats")
async def sync_device_stats(
    device_data: DeviceBasedRequest,
    db = Depends(get_database)
):
    """Sync device usage statistics without incrementing counters"""
    try:
        # Get device information
        device_id = device_data.device_id
        logger.info(f"Syncing stats for device: {device_id}")
        
        # Get current counts from the client
        current_counts = getattr(device_data, 'current_counts', {})
        daily_count = current_counts.get('daily_count', 0)
        monthly_count = current_counts.get('monthly_count', 0)
        total_count = current_counts.get('total_count', 0)
        
        # Get usage collection
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"device_id": device_id})
        
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        if not usage:
            # No record yet - create one with the client's counts
            new_usage = {
                "device_id": device_id,
                "user_id": None,  # Anonymous user
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": total_count,
                "last_reset_daily": today,
                "last_reset_monthly": first_of_month,
                "last_used": now,
                "app_version": device_data.app_version,
                "device_model": device_data.device_model,
                "os_version": device_data.os_version
            }
            await usage_collection.insert_one(new_usage)
            logger.info(f"Created new stats record for device {device_id}")
            return {"status": "created", "counts": current_counts}
        else:
            # Update existing record with client counts
            update_fields = {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": total_count,
                "last_used": now
            }
            
            # Update device info if provided
            if device_data.app_version:
                update_fields["app_version"] = device_data.app_version
            if device_data.device_model:
                update_fields["device_model"] = device_data.device_model
            if device_data.os_version:
                update_fields["os_version"] = device_data.os_version
                
            # Update the record
            await usage_collection.update_one(
                {"device_id": device_id},
                {"$set": update_fields}
            )
            logger.info(f"Updated stats for device {device_id}: {update_fields}")
            return {"status": "updated", "counts": current_counts}
            
    except Exception as e:
        logger.error(f"Error syncing device stats: {str(e)}", exc_info=True)
        # Return a 200 response anyway to prevent client retries
        return {"status": "error", "message": str(e)}

@tryon_router.get("/check-only/{device_id}")
async def check_device_only(device_id: str, is_subscribed: bool = False, read_only: bool = True, db = Depends(get_database)):
    """Check if a device exists in the database and its usage limits without incrementing counts"""
    try:
        logger.info(f"Device check-only for: {device_id} (subscribed: {is_subscribed})")
        
        # Get usage data directly from database
        usage_collection = db[settings.DB_NAME]["tryon_usage"]
        usage = await usage_collection.find_one({"device_id": device_id})
        
        now = datetime.utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # If there's no usage record, this device doesn't exist yet
        if not usage:
            logger.info(f"Device {device_id} not found in database")
            return {
                "device_exists": False,
                "counts": {
                    "daily_count": 0,
                    "monthly_count": 0,
                    "total_count": 0
                }
            }
            
        # Device exists, check if counts need to be reset
        # Check if we need to reset the daily count
        last_reset_daily = usage.get("last_reset_daily", today)
        daily_count = usage.get("daily_count", 0)
        
        if isinstance(last_reset_daily, datetime) and last_reset_daily.date() < today.date():
            # It's a new day, update the count in memory but don't change database
            daily_count = 0
            
        # Check if we need to reset the monthly count    
        last_reset_monthly = usage.get("last_reset_monthly", first_of_month)
        monthly_count = usage.get("monthly_count", 0)
        
        if isinstance(last_reset_monthly, datetime) and last_reset_monthly.date().month < now.date().month:
            # It's a new month, update the count in memory but don't change database
            monthly_count = 0
        
        # Return the current counts and status
        return {
            "device_exists": True,
            "counts": {
                "daily_count": daily_count,
                "monthly_count": monthly_count,
                "total_count": usage.get("total_count", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in check-only for device {device_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check device: {str(e)}"
        ) 