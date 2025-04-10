from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create a MongoDB client
client = None
db = None

async def connect_to_mongodb():
    """Connect to MongoDB database"""
    global client, db
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DB_NAME]
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        raise

async def close_mongodb_connection():
    """Close MongoDB connection"""
    global client
    if client is not None:
        client.close()
        logger.info("MongoDB connection closed")

def get_database():
    """Return database instance"""
    return db

async def get_mongodb_connection():
    """Return database instance (async version)"""
    if db is None:
        logger.warning("Database connection not initialized. Attempting to connect...")
        await connect_to_mongodb()
    return db

def get_user_collection():
    """Return users collection"""
    if db is None:
        logger.warning("Database connection not initialized. Returning None for user collection.")
        return None
    return db.users

def get_device_tokens_collection():
    """Return device tokens collection for push notifications"""
    if db is None:
        logger.warning("Database connection not initialized. Returning None for device tokens collection.")
        return None
    return db.device_tokens

def get_notification_preferences_collection():
    """Return notification preferences collection"""
    if db is None:
        logger.warning("Database connection not initialized. Returning None for notification preferences collection.")
        return None
    return db.notification_preferences

def get_user_engagement_collection():
    """Return user engagement collection"""
    if db is None:
        logger.warning("Database connection not initialized. Returning None for user engagement collection.")
        return None
    return db.user_engagement

async def track_tryon_usage(user_id: str, db = None):
    """
    Track tryon API usage for a user.
    - Increments daily count
    - Increments total count
    - Updates last_used timestamp
    Returns the updated usage counts.
    """
    if db is None:
        logger.warning("Database connection not initialized. Cannot track tryon usage.")
        return {"daily_count": 0, "total_count": 0}
    
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get the tryon_usage collection
    tryon_usage_collection = db.tryon_usage
    
    # Find existing record for the user
    usage_record = await tryon_usage_collection.find_one({"user_id": user_id})
    
    if usage_record:
        # Check if we need to reset the daily count (new day)
        last_reset = usage_record.get("last_reset", now)
        if last_reset < today_start:
            # It's a new day, reset the daily count
            daily_count = 1
            await tryon_usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "daily_count": daily_count,
                    "last_reset": now,
                    "last_used": now
                },
                "$inc": {"total_count": 1}}
            )
        else:
            # Same day, increment both counts
            daily_count = usage_record.get("daily_count", 0) + 1
            await tryon_usage_collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "daily_count": daily_count,
                    "last_used": now
                },
                "$inc": {"total_count": 1}}
            )
        
        total_count = usage_record.get("total_count", 0) + 1
    else:
        # First time usage, create a new record
        daily_count = 1
        total_count = 1
        await tryon_usage_collection.insert_one({
            "user_id": user_id,
            "daily_count": daily_count,
            "total_count": total_count,
            "last_reset": now,
            "last_used": now
        })
    
    # Log the updated values
    logger.info(f"User {user_id} try-on count updated: daily={daily_count}, total={total_count}")
    
    return {
        "daily_count": daily_count,
        "total_count": total_count,
        "last_used": now
    }

async def initialize_tryon_usage_for_user(user_id: str, db = None):
    """
    Initialize try-on usage for a specific user.
    Creates an empty usage record if one doesn't exist.
    """
    if db is None:
        db = await get_mongodb_connection()
        if db is None:
            logger.error("Database connection is None. Cannot initialize tryon usage.")
            return None
    
    # Get the tryon_usage collection
    tryon_usage_collection = db.tryon_usage
    
    # Check if a record already exists
    usage_record = await tryon_usage_collection.find_one({"user_id": user_id})
    
    if usage_record:
        logger.info(f"User {user_id} already has a try-on usage record.")
        return usage_record
    
    # Create a new record
    now = datetime.utcnow()
    new_record = {
        "user_id": user_id,
        "daily_count": 0,
        "total_count": 0,
        "last_reset": now,
        "last_used": None
    }
    
    # Insert the new record
    await tryon_usage_collection.insert_one(new_record)
    logger.info(f"Created new try-on usage record for user {user_id}")
    
    return new_record 