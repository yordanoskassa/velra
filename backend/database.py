from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import logging

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

def get_headlines_collection():
    """Return headlines collection"""
    if db is None:
        logger.warning("Database connection not initialized. Returning None for headlines collection.")
        return None
    return db.headlines

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