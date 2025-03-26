from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from database import get_mongodb_connection, get_device_tokens_collection, get_notification_preferences_collection, get_headlines_collection
import models
from typing import Dict, Any, List, Optional
from bson import ObjectId
from datetime import datetime
import logging
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from requests.exceptions import ConnectionError, HTTPError
from .users import get_current_user

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)

logger = logging.getLogger(__name__)

# Function to actually send notification via Expo
async def send_push_notification(token, title, message, extra=None):
    """Send a push notification via Expo's push service"""
    try:
        if not token:
            logger.error("No token provided for push notification")
            return None

        # Create message
        push_message = PushMessage(
            to=token,
            title=title,
            body=message,
            data=extra or {},
            sound="default",
            badge=1,
        )

        # Send message
        response = PushClient().publish(push_message)
        logger.info(f"Push notification sent. Response: {response}")
        return response
        
    except PushServerError as e:
        logger.error(f"Push server error: {e}")
        # Handle failed request
        return None
    except (ConnectionError, HTTPError) as e:
        logger.error(f"Connection or HTTP error: {e}")
        # Handle connection errors
        return None
    except DeviceNotRegisteredError:
        logger.error(f"Device not registered: {token}")
        # Mark the token as inactive
        db = await get_mongodb_connection()
        device_tokens = get_device_tokens_collection()
        await device_tokens.update_one(
            {"token": token},
            {"$set": {"active": False}}
        )
        return None
    except Exception as e:
        logger.error(f"Unknown error when sending push notification: {e}")
        return None

async def send_notification_to_user(user_id, title, message, extra=None):
    """Send notification to all active devices for a specific user"""
    try:
        db = await get_mongodb_connection()
        device_tokens = get_device_tokens_collection()
        
        # Get all active tokens for the user
        tokens = await device_tokens.find(
            {"user_id": user_id, "active": True}
        ).to_list(length=100)
        
        if not tokens:
            logger.warning(f"No active device tokens found for user {user_id}")
            return False
            
        # Send to all devices
        results = []
        for token_doc in tokens:
            result = await send_push_notification(
                token_doc["token"], 
                title, 
                message, 
                extra
            )
            results.append(result)
            
        return any(results)  # Return True if at least one notification was sent
        
    except Exception as e:
        logger.error(f"Error sending notifications to user {user_id}: {e}")
        return False

@router.post("/register-device", response_model=Dict[str, Any])
async def register_device(
    device: models.DeviceToken,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Register a device token for push notifications"""
    try:
        device_tokens = get_device_tokens_collection()
        
        # Check if this token already exists
        existing_token = await device_tokens.find_one({"token": device.token})
        
        if existing_token:
            # Update the token with current user and mark as active
            await device_tokens.update_one(
                {"token": device.token},
                {
                    "$set": {
                        "user_id": str(current_user["_id"]),
                        "active": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            token_id = str(existing_token["_id"])
            logger.info(f"Updated existing device token for user {current_user['email']}")
        else:
            # Create a new token entry
            result = await device_tokens.insert_one({
                "token": device.token,
                "device_type": device.device_type,
                "user_id": str(current_user["_id"]),
                "active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            token_id = str(result.inserted_id)
            logger.info(f"Registered new device token for user {current_user['email']}")
        
        # Send a welcome notification in the background
        background_tasks.add_task(
            send_push_notification,
            device.token,
            "Notifications Enabled",
            "You'll now receive notifications about hot headlines!",
            {"type": "welcome"}
        )
        
        return {
            "id": token_id,
            "token": device.token,
            "status": "registered",
            "message": "Device registered successfully"
        }
        
    except Exception as e:
        logger.error(f"Error registering device: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register device: {str(e)}"
        )

@router.delete("/unregister-device/{token}", response_model=Dict[str, Any])
async def unregister_device(
    token: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Unregister a device token from push notifications"""
    try:
        device_tokens = get_device_tokens_collection()
        
        # Mark the token as inactive instead of deleting
        result = await device_tokens.update_one(
            {"token": token, "user_id": str(current_user["_id"])},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Device token not found or already unregistered"
            )
            
        logger.info(f"Unregistered device token for user {current_user['email']}")
        
        return {
            "token": token,
            "status": "unregistered",
            "message": "Device unregistered successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unregistering device: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unregister device: {str(e)}"
        )

@router.get("/preferences", response_model=models.NotificationResponse)
async def get_notification_preferences(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Get the notification preferences for the current user"""
    try:
        notification_prefs = get_notification_preferences_collection()
        
        # Find preferences for the user
        prefs = await notification_prefs.find_one({"user_id": str(current_user["_id"])})
        
        if not prefs:
            # Return default preferences if none exist
            return {
                "user_id": str(current_user["_id"]),
                "preferences": models.NotificationPreferences(),
                "updated_at": datetime.utcnow()
            }
            
        # Format ID for response
        prefs["id"] = str(prefs["_id"])
        
        return prefs
        
    except Exception as e:
        logger.error(f"Error getting notification preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification preferences: {str(e)}"
        )

@router.put("/preferences", response_model=models.NotificationResponse)
async def update_notification_preferences(
    preferences: models.NotificationPreferences,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Update the notification preferences for the current user"""
    try:
        notification_prefs = get_notification_preferences_collection()
        
        # Validate frequency
        valid_frequencies = ["hourly", "daily", "weekly"]
        if preferences.frequency not in valid_frequencies:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid frequency. Must be one of: {', '.join(valid_frequencies)}"
            )
        
        # Convert preferences to dict
        prefs_dict = preferences.dict()
        
        # Update or create preferences
        result = await notification_prefs.update_one(
            {"user_id": str(current_user["_id"])},
            {
                "$set": {
                    "preferences": prefs_dict,
                    "updated_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # Get the updated preferences
        updated_prefs = await notification_prefs.find_one({"user_id": str(current_user["_id"])})
        updated_prefs["id"] = str(updated_prefs["_id"])
        
        logger.info(f"Updated notification preferences for user {current_user['email']}")
        
        return updated_prefs
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification preferences: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification preferences: {str(e)}"
        )

@router.post("/test", response_model=Dict[str, Any])
async def send_test_notification(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Send a test notification to the user's devices"""
    try:
        device_tokens = get_device_tokens_collection()
        
        # Get all active tokens for the user
        tokens = await device_tokens.find(
            {"user_id": str(current_user["_id"]), "active": True}
        ).to_list(length=100)
        
        if not tokens:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No registered devices found. Please register a device first."
            )
            
        # Send test notification to all devices
        success_count = 0
        for token_doc in tokens:
            result = await send_push_notification(
                token_doc["token"],
                "Test Notification",
                "This is a test notification from Decodr",
                {"type": "test"}
            )
            
            if result:
                success_count += 1
                
        logger.info(f"Sent test notifications to {success_count}/{len(tokens)} devices for user {current_user['email']}")
        
        return {
            "success": success_count > 0,
            "message": f"Sent test notifications to {success_count}/{len(tokens)} devices",
            "devices_count": len(tokens)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending test notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test notification: {str(e)}"
        )

@router.post("/send-headlines", response_model=Dict[str, Any])
async def send_headline_notifications(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Send latest hot headlines to the user"""
    try:
        # Check if user has notifications enabled
        notification_prefs = get_notification_preferences_collection()
        prefs = await notification_prefs.find_one({"user_id": str(current_user["_id"])})
        
        if not prefs or not prefs.get("preferences", {}).get("enabled", True):
            return {
                "success": False,
                "message": "Notifications are disabled for this user"
            }
            
        # Get the latest hot headline
        headlines = get_headlines_collection()
        latest_headline = await headlines.find_one(
            {"is_hot": True}, 
            sort=[("publishedAt", -1)]
        )
        
        if not latest_headline:
            return {
                "success": False,
                "message": "No hot headlines available"
            }
            
        # Send the notification in the background
        headline_title = latest_headline.get("title", "Hot Headline")
        headline_id = str(latest_headline.get("_id", ""))
        
        background_tasks.add_task(
            send_notification_to_user,
            str(current_user["_id"]),
            "🔥 Hot Headline Alert",
            headline_title,
            {"type": "headline", "headline_id": headline_id}
        )
        
        return {
            "success": True,
            "message": "Headline notification queued for delivery",
            "headline": {
                "id": headline_id,
                "title": headline_title
            }
        }
        
    except Exception as e:
        logger.error(f"Error sending headline notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send headline notification: {str(e)}"
        ) 