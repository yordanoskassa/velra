from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Form, Query
from typing import List
from .auth import get_current_user
from database import get_mongodb_connection, get_device_tokens_collection, get_notification_preferences_collection
import models
from typing import Dict, Any, List, Optional
from bson import ObjectId
from datetime import datetime, timedelta
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
from database import track_tryon_usage

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
            "You'll receive updates about your virtual try-on experiences!",
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
                "This is a test notification from VELRA Virtual Try-On",
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

@router.post("/send-notification", response_model=Dict[str, Any])
async def send_custom_notification(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Send a custom notification to the user"""
    try:
        # Check if user has notifications enabled
        notification_prefs = get_notification_preferences_collection()
        prefs = await notification_prefs.find_one({"user_id": str(current_user["_id"])})
        
        if not prefs or not prefs.get("preferences", {}).get("enabled", True):
            return {
                "success": False,
                "message": "Notifications are disabled for this user"
            }
            
        # Send a generic notification in the background
        notification_title = "Virtual Try-On Update"
        notification_message = "Your virtual try-on experience is ready to view!"
        
        background_tasks.add_task(
            send_notification_to_user,
            str(current_user["_id"]),
            notification_title,
            notification_message,
            {"type": "virtual_tryon"}
        )
        
        return {
            "success": True,
            "message": "Notification queued for delivery"
        }
        
    except Exception as e:
        logger.error(f"Error sending notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send notification: {str(e)}"
        )

@router.post("/tryon-complete/{prediction_id}", response_model=Dict[str, Any])
async def notify_tryon_complete(
    prediction_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Notify the user that their virtual try-on is complete"""
    try:
        # Check if user has notifications enabled
        notification_prefs = get_notification_preferences_collection()
        prefs = await notification_prefs.find_one({"user_id": str(current_user["_id"])})
        
        if not prefs or not prefs.get("preferences", {}).get("enabled", True):
            return {
                "success": False,
                "message": "Notifications are disabled for this user"
            }
            
        # Send virtual try-on completion notification
        notification_title = "✨ Try-On Complete!"
        notification_message = "Your virtual outfit is ready to view. Check it out now!"
        
        background_tasks.add_task(
            send_notification_to_user,
            str(current_user["_id"]),
            notification_title,
            notification_message,
            {"type": "virtual_tryon_complete", "prediction_id": prediction_id}
        )
        
        return {
            "success": True,
            "message": "Virtual try-on notification sent",
            "prediction_id": prediction_id
        }
        
    except Exception as e:
        logger.error(f"Error sending virtual try-on notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send virtual try-on notification: {str(e)}"
        )

@router.post("/motivational", response_model=Dict[str, Any])
async def send_motivational_notification(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Send a motivational notification to encourage app usage"""
    try:
        # Check if user has notifications enabled
        notification_prefs = get_notification_preferences_collection()
        prefs = await notification_prefs.find_one({"user_id": str(current_user["_id"])})
        
        if not prefs or not prefs.get("preferences", {}).get("enabled", True):
            return {
                "success": False,
                "message": "Notifications are disabled for this user"
            }
            
        # List of motivational messages
        motivational_messages = [
            {"title": "✨ Transform Your Look Today!", "body": "Try on our latest collection virtually - see yourself in new styles!"},
            {"title": "👗 Ready for a Wardrobe Update?", "body": "Discover how you'd look in trending outfits without trying them on physically!"},
            {"title": "🔥 Fashion Forward Alert", "body": "See yourself in this season's hottest styles with just a few taps!"},
            {"title": "👚 Missing Out On Great Styles?", "body": "Try our virtual fitting room and transform your look instantly!"},
            {"title": "👔 Upgrade Your Style Game", "body": "Virtual try-on makes shopping easier - try before you buy!"},
            {"title": "🛍️ Shopping Made Simple", "body": "Save time with our virtual try-on - no more fitting room lines!"},
            {"title": "🎁 Discover Your Perfect Look", "body": "Our AI will help you find outfits that look amazing on you!"},
            {"title": "🌟 Stand Out From The Crowd", "body": "Try something bold with zero risk using our virtual try-on!"}
        ]
        
        # Select a random motivational message
        import random
        message = random.choice(motivational_messages)
        
        # Send the motivational notification
        background_tasks.add_task(
            send_notification_to_user,
            str(current_user["_id"]),
            message["title"],
            message["body"],
            {"type": "motivational"}
        )
        
        return {
            "success": True,
            "message": "Motivational notification queued for delivery"
        }
        
    except Exception as e:
        logger.error(f"Error sending motivational notification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send motivational notification: {str(e)}"
        )

@router.post("/track-engagement", response_model=Dict[str, Any])
async def track_user_engagement(
    engagement_type: str = Form(...),  # login, tryon, notification_open, app_open
    category: Optional[str] = Form(None),  # Optional category for tryons
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Track user engagement with the app for better notification targeting"""
    try:
        # Get engagement collection
        engagement_collection = db.user_engagement
        
        # Find existing engagement record
        engagement = await engagement_collection.find_one({"user_id": str(current_user["_id"])})
        
        now = datetime.utcnow()
        update_data = {"updated_at": now}
        
        # Update specific engagement metrics based on type
        if engagement_type == "login":
            update_data["last_login"] = now
            update_data["inactive_days"] = 0
            update_data["app_opens_count"] = engagement.get("app_opens_count", 0) + 1 if engagement else 1
            
        elif engagement_type == "tryon":
            update_data["last_tryon"] = now
            update_data["tryons_count"] = engagement.get("tryons_count", 0) + 1 if engagement else 1
            
            # Track category preferences if provided
            if category:
                # Add to favorite categories array if not already there
                await engagement_collection.update_one(
                    {"user_id": str(current_user["_id"])},
                    {"$addToSet": {"favorite_categories": category}},
                    upsert=True
                )
                
            # Also track in the new tryon usage system
            await track_tryon_usage(str(current_user["_id"]))
                
        elif engagement_type == "notification_open":
            update_data["notification_opens"] = engagement.get("notification_opens", 0) + 1 if engagement else 1
            
        elif engagement_type == "app_open":
            update_data["app_opens_count"] = engagement.get("app_opens_count", 0) + 1 if engagement else 1
            update_data["inactive_days"] = 0
        
        # Update the engagement record
        await engagement_collection.update_one(
            {"user_id": str(current_user["_id"])},
            {"$set": update_data},
            upsert=True
        )
        
        return {
            "success": True,
            "message": f"Engagement tracked: {engagement_type}"
        }
        
    except Exception as e:
        logger.error(f"Error tracking user engagement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track engagement: {str(e)}"
        )

@router.post("/target-inactive-users", response_model=Dict[str, Any])
async def send_inactive_user_notifications(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection),
    days_threshold: int = Query(7, description="Number of days of inactivity to trigger notification")
):
    """Send notifications to users who haven't used the app in a while"""
    try:
        if not current_user.get("is_admin", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can trigger batch notifications"
            )
            
        # Inactive user messages
        inactive_messages = [
            {"title": "👋 We Miss You!", "body": "Come back and see the latest styles you can try on virtually!"},
            {"title": "🔍 Discover New Looks", "body": "We've added new outfits for you to try on - see how they look on you!"},
            {"title": "🛍️ Shopping Made Easier", "body": "Find your perfect style before buying with our virtual try-on!"},
            {"title": "💯 Your Style Profile Misses You", "body": "Return and try on new outfits that match your style preferences!"}
        ]
        
        # Get a random message
        import random
        message = random.choice(inactive_messages)
        
        # Get engagement collection
        engagement_collection = db.user_engagement
        notification_prefs = get_notification_preferences_collection()
        device_tokens = get_device_tokens_collection()
        
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        # Find inactive users
        pipeline = [
            {
                "$match": {
                    "$or": [
                        {"last_login": {"$lt": cutoff_date}},
                        {"last_login": {"$exists": False}}
                    ],
                    "inactive_days": {"$gte": days_threshold}
                }
            },
            {
                "$lookup": {
                    "from": "notification_preferences",
                    "localField": "user_id",
                    "foreignField": "user_id",
                    "as": "notification_settings"
                }
            },
            {
                "$match": {
                    "$or": [
                        {"notification_settings.preferences.enabled": True},
                        {"notification_settings": {"$size": 0}}
                    ]
                }
            }
        ]
        
        inactive_users = await engagement_collection.aggregate(pipeline).to_list(length=1000)
        
        # Send notifications to inactive users
        notification_count = 0
        for user in inactive_users:
            user_id = user.get("user_id")
            
            # Get active device tokens for this user
            user_tokens = await device_tokens.find(
                {"user_id": user_id, "active": True}
            ).to_list(length=100)
            
            if not user_tokens:
                continue
                
            # Send to all devices
            for token_doc in user_tokens:
                token = token_doc.get("token")
                if token:
                    background_tasks.add_task(
                        send_push_notification,
                        token,
                        message["title"],
                        message["body"],
                        {"type": "re_engagement"}
                    )
                    notification_count += 1
                    
        return {
            "success": True,
            "message": f"Queued re-engagement notifications for {notification_count} devices"
        }
        
    except Exception as e:
        logger.error(f"Error sending re-engagement notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send re-engagement notifications: {str(e)}"
        )
