from fastapi import APIRouter, Depends, HTTPException, status
from database import get_mongodb_connection
import models
from typing import Optional, Dict, Any, List
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from config import settings
from pydantic import BaseModel
import logging
from bson import ObjectId
from datetime import datetime

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# Function to get current user as MongoDB document
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user from JWT token as a MongoDB document"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
        
        # Get MongoDB connection
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Find user by email
        user = await users_collection.find_one({"email": email})
        if user is None:
            raise credentials_exception
            
        return user
    except JWTError:
        raise credentials_exception

class SubscriptionStatus(BaseModel):
    isPremium: bool

class RevenueCatLink(BaseModel):
    revenuecat_id: str

# Add a new model for insight tracking
class InsightUsage(BaseModel):
    count: Optional[int] = None
    increment: bool = True
    reset: bool = False

@router.get("/me", response_model=models.UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    # Convert MongoDB _id to string for response
    user_resp = dict(current_user)
    user_resp["id"] = str(user_resp.get("_id"))
    
    # Ensure all required fields are present
    if "created_at" not in user_resp:
        user_resp["created_at"] = datetime.utcnow()
    if "isPremium" not in user_resp:
        user_resp["isPremium"] = False
    
    return user_resp

@router.get("/subscription-status", response_model=SubscriptionStatus)
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Check if the current user has an active premium subscription"""
    # Get MongoDB connection to check latest user data
    db = await get_mongodb_connection()
    users_collection = db["users"]
    
    # Get the latest user data from the database
    user_data = await users_collection.find_one({"_id": current_user["_id"]})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check subscription status from multiple sources
    is_subscribed = False
    
    # Method 1: Check the isPremium flag (set directly in our database)
    if user_data.get("isPremium", False):
        logger.info(f"User {user_data['email']} is premium based on isPremium flag")
        is_subscribed = True
    
    # Method 2: Check any subscription data in our database
    elif user_data.get("subscription", {}).get("is_active", False):
        logger.info(f"User {user_data['email']} has active subscription in our database")
        is_subscribed = True
    
    # Method 3: Check RevenueCat ID if present
    # In a real implementation, this would make an API call to RevenueCat to verify
    # the subscription status for the linked RevenueCat ID
    elif "revenuecat_id" in user_data:
        # This is a placeholder for the actual RevenueCat API call
        # In a real implementation, you would call RevenueCat's API to verify the subscription
        logger.info(f"User {user_data['email']} has RevenueCat ID, would verify with their API")
        # For demo purposes, we're not making the actual API call
        
    # Log the result
    logger.info(f"Subscription check for user {user_data['email']}: {is_subscribed}")
    
    # Return the result with the field name that the frontend expects
    return {"isPremium": is_subscribed}

@router.put("/subscription-status", response_model=SubscriptionStatus)
async def update_subscription_status(
    subscription: SubscriptionStatus,
    current_user: dict = Depends(get_current_user),
):
    """Update a user's premium subscription status"""
    try:
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Update the isPremium field in MongoDB
        result = await users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"isPremium": subscription.isPremium, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found or no changes made")
        
        return {"isPremium": subscription.isPremium}
    except Exception as e:
        logger.error(f"Error updating subscription status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update subscription status")

@router.put("/link-revenuecat", response_model=dict)
async def link_revenuecat_id(
    revenuecat_data: RevenueCatLink,
    current_user: dict = Depends(get_current_user),
):
    """Link a user's account with their RevenueCat ID"""
    try:
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Update the revenuecat_id field in MongoDB
        result = await users_collection.update_one(
            {"_id": current_user["_id"]},
            {
                "$set": {
                    "revenuecat_id": revenuecat_data.revenuecat_id,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found or no changes made")
        
        logger.info(f"User {current_user['email']} linked to RevenueCat ID: {revenuecat_data.revenuecat_id}")
        
        # Check if the RevenueCat ID already has a subscription
        # This would be implemented in a real app by calling RevenueCat's API
        
        return {
            "status": "success",
            "message": "RevenueCat ID linked successfully",
            "revenuecat_id": revenuecat_data.revenuecat_id
        }
    except Exception as e:
        logger.error(f"Error linking RevenueCat ID: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to link RevenueCat ID")

# Add a new endpoint to track insights
@router.post("/insights-usage", response_model=Dict[str, Any])
async def track_insights_usage(
    usage: InsightUsage,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Track and update user's insight usage count"""
    
    # Get user's document from the database
    users_collection = db["users"]
    user_data = await users_collection.find_one({"_id": current_user["_id"]})
    
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has premium status - premium users have unlimited insights
    if user_data.get("isPremium", False) or user_data.get("subscription", {}).get("is_active", False):
        return {"insights_count": 0, "is_premium": True, "limit_reached": False}
    
    # Initialize the insights_count if it doesn't exist
    if "insights_count" not in user_data:
        user_data["insights_count"] = 0
    
    current_count = user_data["insights_count"]
    new_count = current_count
    
    # Reset count if requested
    if usage.reset:
        new_count = 0
    # Set specific count if provided
    elif usage.count is not None:
        new_count = usage.count
    # Increment count if requested
    elif usage.increment:
        new_count = current_count + 1
    
    # Update the user document with the new count
    await users_collection.update_one(
        {"_id": user_data["_id"]},
        {"$set": {"insights_count": new_count}}
    )
    
    # Check if user has reached the limit (3 insights)
    limit_reached = new_count >= 3
    
    return {
        "insights_count": new_count,
        "is_premium": False,
        "limit_reached": limit_reached
    } 