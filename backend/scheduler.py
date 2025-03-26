from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
from routes.news import _fetch_and_save_headlines
import asyncio
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

async def send_notification_to_users(frequency):
    """Send notifications to users based on frequency preference"""
    try:
        logger.info(f"Sending {frequency} headline notifications...")
        
        # Get notification preferences collection
        notification_prefs = db.notification_preferences
        device_tokens = db.device_tokens
        headlines = db.headlines
        
        # Get users who have enabled notifications with matching frequency
        user_prefs = notification_prefs.find({
            "preferences.enabled": True,
            "preferences.frequency": frequency
        })
        
        # Get the latest hot headline
        latest_headline = await headlines.find_one(
            {"is_hot": True},
            sort=[("publishedAt", -1)]
        )
        
        if not latest_headline:
            logger.warning("No hot headlines available for notifications")
            return
            
        headline_title = latest_headline.get("title", "Hot Headline")
        headline_id = str(latest_headline.get("_id", ""))
        
        notification_count = 0
        
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
                        "🔥 Hot Headline Alert",
                        headline_title,
                        {"type": "headline", "headline_id": headline_id}
                    )
                    notification_count += 1
                    
        logger.info(f"Sent {notification_count} {frequency} notifications")
        
    except Exception as e:
        logger.error(f"Error in send_notification_to_users: {e}")

async def schedule_notifications():
    """Schedule notifications based on frequency"""
    # Hourly notifications (on the hour)
    scheduler.add_job(
        lambda: asyncio.create_task(send_notification_to_users("hourly")),
        'cron',
        hour='*',
        minute=0
    )
    
    # Daily notifications (at 9:00 AM)
    scheduler.add_job(
        lambda: asyncio.create_task(send_notification_to_users("daily")),
        'cron',
        hour=9,
        minute=0
    )
    
    # Weekly notifications (Monday at 9:00 AM)
    scheduler.add_job(
        lambda: asyncio.create_task(send_notification_to_users("weekly")),
        'cron',
        day_of_week='mon',
        hour=9,
        minute=0
    )
    
    logger.info("Notification schedules initialized")

# Define other scheduled tasks
async def fetch_latest_news():
    """Fetch latest news from external API"""
    logger.info("Fetching latest news...")
    try:
        async with httpx.AsyncClient() as client:
            # This would be your actual news API endpoint
            response = await client.get(f"{settings.API_BASE_URL}/news/refresh-headlines")
            if response.status_code == 200:
                logger.info("Successfully refreshed headlines")
            else:
                logger.error(f"Failed to refresh headlines: {response.status_code}")
    except Exception as e:
        logger.error(f"Error fetching latest news: {e}")

async def cleanup_old_data():
    """Cleanup old data from database"""
    try:
        # Delete very old headlines (older than 30 days)
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        result = await db.headlines.delete_many({
            "publishedAt": {"$lt": cutoff_date.isoformat()}
        })
        logger.info(f"Deleted {result.deleted_count} old headlines")
        
        # Mark inactive device tokens (not used in 90 days)
        token_cutoff = datetime.utcnow() - timedelta(days=90)
        result = await db.device_tokens.update_many(
            {"updated_at": {"$lt": token_cutoff}},
            {"$set": {"active": False}}
        )
        logger.info(f"Marked {result.modified_count} device tokens as inactive")
    except Exception as e:
        logger.error(f"Error cleaning up old data: {e}")

# Start scheduler
def setup_scheduler():
    logger.info("Starting scheduler...")
    
    # Initialize notification schedules
    asyncio.create_task(schedule_notifications())
    
    # Schedule news fetch every hour
    scheduler.add_job(
        lambda: asyncio.create_task(fetch_latest_news()),
        'interval',
        hours=1
    )
    
    # Schedule cleanup task daily at midnight
    scheduler.add_job(
        lambda: asyncio.create_task(cleanup_old_data()),
        'cron',
        hour=0,
        minute=0
    )
    
    scheduler.start()
    logger.info("Scheduler started")

if __name__ == "__main__":
    import uvloop
    uvloop.install()
    
    loop = asyncio.get_event_loop()
    setup_scheduler()
    
    try:
        loop.run_forever()
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        scheduler.shutdown()
        loop.close() 