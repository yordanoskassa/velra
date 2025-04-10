from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
import asyncio
import random
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from exponent_server_sdk import PushClient, PushMessage
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize MongoDB client
client = AsyncIOMotorClient(settings.MONGODB_URL)
db = client[settings.DB_NAME]

# Create scheduler
scheduler = AsyncIOScheduler()

# Motivational messages for virtual try-on
MOTIVATIONAL_MESSAGES = [
    {"title": "✨ Transform Your Look Today!", "body": "Try on our latest collection virtually - see yourself in new styles!"},
    {"title": "👗 Ready for a Wardrobe Update?", "body": "Discover how you'd look in trending outfits without trying them on physically!"},
    {"title": "🔥 Fashion Forward Alert", "body": "See yourself in this season's hottest styles with just a few taps!"},
    {"title": "👚 Missing Out On Great Styles?", "body": "Try our virtual fitting room and transform your look instantly!"},
    {"title": "👔 Upgrade Your Style Game", "body": "Virtual try-on makes shopping easier - try before you buy!"},
    {"title": "🛍️ Shopping Made Simple", "body": "Save time with our virtual try-on - no more fitting room lines!"},
    {"title": "🎁 Discover Your Perfect Look", "body": "Our AI will help you find outfits that look amazing on you!"},
    {"title": "🌟 Stand Out From The Crowd", "body": "Try something bold with zero risk using our virtual try-on!"}
]

async def send_push_notification(token, title, message, extra=None):
    """Send a push notification via Expo's push service"""
    try:
        push_message = PushMessage(
            to=token,
            title=title,
            body=message,
            data=extra or {},
            sound="default",
            badge=1,
        )
        
        response = PushClient().publish(push_message)
        logger.info(f"Push notification sent. Response: {response}")
        return response
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return None

async def send_notification_to_users(frequency, notification_type="general"):
    """Send notifications to users based on frequency preference"""
    try:
        logger.info(f"Sending {frequency} {notification_type} notifications...")
        
        # Get notification preferences collection
        notification_prefs = db.notification_preferences
        device_tokens = db.device_tokens
        
        # Get users who have enabled notifications with matching frequency
        user_prefs = notification_prefs.find({
            "preferences.enabled": True,
            "preferences.frequency": frequency
        })
        
        notification_count = 0
        
        # Select a random motivational message if type is motivational
        message = random.choice(MOTIVATIONAL_MESSAGES) if notification_type == "motivational" else {
            "title": "🔔 VELRA Update",
            "body": "Check out what's new in our virtual try-on experience!"
        }
        
        async for user_pref in user_prefs:
            user_id = user_pref.get("user_id")
            
            if not user_id:
                continue
                
            # Get active device tokens for this user
            user_tokens = await device_tokens.find(
                {"user_id": user_id, "active": True}
            ).to_list(length=100)
            
            if not user_tokens:
                logger.debug(f"No active device tokens for user {user_id}")
                continue
                
            # Send notification to each device
            for token_doc in user_tokens:
                token = token_doc.get("token")
                if token:
                    await send_push_notification(
                        token,
                        message["title"],
                        message["body"],
                        {"type": notification_type}
                    )
                    notification_count += 1
                    
        logger.info(f"Sent {notification_count} {frequency} {notification_type} notifications")
        
    except Exception as e:
        logger.error(f"Error in send_notification_to_users: {e}")

async def send_motivational_notifications():
    """Send motivational notifications to all eligible users"""
    await send_notification_to_users("daily", "motivational")

async def schedule_notifications():
    """Schedule notifications based on frequency"""
    # Motivational notifications at optimal engagement times
    # Morning - 9:00 AM
    scheduler.add_job(
        lambda: asyncio.create_task(send_motivational_notifications()),
        'cron',
        hour=9,
        minute=0
    )
    
    # Lunch time - 12:30 PM
    scheduler.add_job(
        lambda: asyncio.create_task(send_motivational_notifications()),
        'cron',
        hour=12,
        minute=30
    )
    
    # Evening - 6:00 PM (peak shopping time)
    scheduler.add_job(
        lambda: asyncio.create_task(send_motivational_notifications()),
        'cron',
        hour=18,
        minute=0
    )
    
    # Weekend bonus notification - Saturday at 11:00 AM
    scheduler.add_job(
        lambda: asyncio.create_task(send_motivational_notifications()),
        'cron',
        day_of_week='sat',
        hour=11,
        minute=0
    )
    
    logger.info("Notification schedules initialized")

async def cleanup_old_data():
    """Cleanup old data from database"""
    try:
        # Mark inactive device tokens (not used in 90 days)
        token_cutoff = datetime.utcnow() - timedelta(days=90)
        result = await db.device_tokens.update_many(
            {"updated_at": {"$lt": token_cutoff}},
            {"$set": {"active": False}}
        )
        logger.info(f"Marked {result.modified_count} device tokens as inactive")
    except Exception as e:
        logger.error(f"Error cleaning up old data: {e}")

async def update_inactive_days():
    """Update inactive days counter for users who haven't logged in"""
    try:
        logger.info("Updating inactive days counters...")
        
        # Get engagement collection
        engagement_collection = db.user_engagement
        
        # Update all records by incrementing inactive_days by 1
        result = await engagement_collection.update_many(
            {},  # Match all records
            {"$inc": {"inactive_days": 1}}
        )
        
        logger.info(f"Updated inactive_days for {result.modified_count} users")
    except Exception as e:
        logger.error(f"Error updating inactive days: {e}")

# Start scheduler
def setup_scheduler():
    logger.info("Starting scheduler...")
    
    # Initialize notification schedules
    asyncio.create_task(schedule_notifications())
    
    # Schedule cleanup task daily at midnight
    scheduler.add_job(
        lambda: asyncio.create_task(cleanup_old_data()),
        'cron',
        hour=0,
        minute=0
    )
    
    # Update inactive days counter daily at 1:00 AM
    scheduler.add_job(
        lambda: asyncio.create_task(update_inactive_days()),
        'cron',
        hour=1,
        minute=0
    )
    
    scheduler.start()
    logger.info("Scheduler started")

if __name__ == "__main__":
    import uvloop
    uvloop.install()
    
    loop = asyncio.get_event_loop()
    setup_scheduler() 