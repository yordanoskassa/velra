from fastapi import APIRouter, Depends, HTTPException, status, Body
from database import get_mongodb_connection
import models
from routes.users import get_current_user
from typing import List, Optional
from pydantic import BaseModel, EmailStr
import logging
from bson import ObjectId
from datetime import datetime

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)

logger = logging.getLogger(__name__)

class UserPremiumUpdate(BaseModel):
    user_id: str
    is_premium: bool

class UserUpdateRequest(BaseModel):
    email: EmailStr
    is_premium: bool = False

class SubscriptionManualUpdate(BaseModel):
    email: EmailStr
    is_subscribed: bool
    reason: Optional[str] = None

@router.put("/update-premium-status", response_model=models.UserResponse)
async def update_user_premium_status(
    update_data: UserPremiumUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a user's premium status (admin only)"""
    # In a real app you would check admin permissions here
    # For now, we assume all authenticated users are admins
    try:
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Convert string ID to ObjectId for MongoDB
        try:
            user_id = ObjectId(update_data.user_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
        
        # Update the user's premium status
        result = await users_collection.update_one(
            {"_id": user_id},
            {"$set": {"isPremium": update_data.is_premium, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found or no changes made")
        
        # Get the updated user document
        updated_user = await users_collection.find_one({"_id": user_id})
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prepare the user response
        user_resp = dict(updated_user)
        user_resp["id"] = str(user_resp.get("_id"))
        
        # Ensure all required fields are present
        if "created_at" not in user_resp:
            user_resp["created_at"] = datetime.utcnow()
        if "is_active" not in user_resp:
            user_resp["is_active"] = True
        
        return user_resp
    except Exception as e:
        logger.error(f"Error updating premium status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update premium status")

@router.post("/update-user-premium")
async def update_user_premium_status(update_data: UserUpdateRequest):
    """
    Admin endpoint to update a user's premium status
    """
    try:
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Find the user by email
        user = await users_collection.find_one({"email": update_data.email})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update the isPremium status
        result = await users_collection.update_one(
            {"email": update_data.email},
            {"$set": {"isPremium": update_data.is_premium, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            return {"status": "unchanged", "message": "User premium status was already set to this value"}
        
        return {
            "status": "success",
            "message": f"User premium status updated to: {update_data.is_premium}",
            "user_email": update_data.email
        }
    except Exception as e:
        logger.error(f"Error updating user premium status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating user status: {str(e)}")

@router.post("/manual-subscription-update")
async def manual_subscription_update(update_data: SubscriptionManualUpdate):
    """
    Admin endpoint to manually update a user's subscription status
    This is useful for testing or fixing subscription issues
    """
    try:
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Find the user by email
        user = await users_collection.find_one({"email": update_data.email})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update the subscription status and add a manual override flag
        result = await users_collection.update_one(
            {"email": update_data.email},
            {
                "$set": {
                    "isPremium": update_data.is_subscribed,
                    "subscription": {
                        "status": "active" if update_data.is_subscribed else "canceled",
                        "manually_updated": True,
                        "update_reason": update_data.reason or "Manual admin update",
                        "updated_at": datetime.utcnow()
                    },
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Log this admin action for audit purposes
        logger.info(f"Admin manually updated subscription status for {update_data.email} to {update_data.is_subscribed}")
        
        if result.modified_count == 0:
            return {"status": "unchanged", "message": "User subscription status was already set to this value"}
        
        return {
            "status": "success",
            "message": f"User subscription status updated to: {update_data.is_subscribed}",
            "user_email": update_data.email
        }
    except Exception as e:
        logger.error(f"Error manually updating subscription status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating subscription status: {str(e)}") 