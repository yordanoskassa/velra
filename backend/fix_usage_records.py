import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from config import settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def connect_to_db():
    """Connect to MongoDB database"""
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        db = client[settings.DB_NAME]
        logger.info(f"Connected to MongoDB: {settings.MONGODB_URL}, Database: {settings.DB_NAME}")
        return client, db
    except Exception as e:
        logger.error(f"Could not connect to MongoDB: {e}")
        raise

async def create_missing_usage_records():
    """Create missing usage records for users who don't have them"""
    client, db = await connect_to_db()
    
    try:
        # Get the users and tryon_usage collections
        users_collection = db.users
        tryon_usage_collection = db.tryon_usage
        
        # Get all users
        users = await users_collection.find({}).to_list(length=1000)
        logger.info(f"Found {len(users)} users")
        
        # Check for missing usage records
        for user in users:
            user_id = str(user.get('_id'))
            email = user.get('email', 'unknown')
            
            # Check if a usage record exists
            usage_record = await tryon_usage_collection.find_one({"user_id": user_id})
            
            if not usage_record:
                logger.info(f"Creating missing usage record for user {email} ({user_id})")
                
                # Create a new usage record
                now = datetime.utcnow()
                new_record = {
                    "user_id": user_id,
                    "daily_count": 0,
                    "total_count": 0,
                    "last_reset": now,
                    "last_used": None
                }
                
                # Insert the new record
                result = await tryon_usage_collection.insert_one(new_record)
                logger.info(f"Created usage record for {email}: {result.inserted_id}")
            else:
                logger.info(f"User {email} already has a usage record")
                
        # Print the collection statistics
        count = await tryon_usage_collection.count_documents({})
        logger.info(f"Total usage records after fix: {count}")
        
    finally:
        # Close the MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

async def view_usage_records():
    """View all usage records in the database"""
    client, db = await connect_to_db()
    
    try:
        # Get the tryon_usage collection
        tryon_usage_collection = db.tryon_usage
        
        # Get all usage records
        usage_records = await tryon_usage_collection.find({}).to_list(length=1000)
        logger.info(f"Found {len(usage_records)} usage records")
        
        # Print each record
        for record in usage_records:
            user_id = record.get('user_id')
            daily_count = record.get('daily_count', 0)
            total_count = record.get('total_count', 0)
            last_used = record.get('last_used')
            
            # Get user info
            user = await db.users.find_one({"_id": user_id})
            email = user.get('email', 'unknown') if user else 'unknown'
            
            logger.info(f"User: {email}, Daily: {daily_count}, Total: {total_count}, Last Used: {last_used}")
            
    finally:
        # Close the MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

async def check_specific_user(email):
    """Check usage records for a specific user"""
    client, db = await connect_to_db()
    
    try:
        # Get the users and tryon_usage collections
        users_collection = db.users
        tryon_usage_collection = db.tryon_usage
        
        # Find the user
        user = await users_collection.find_one({"email": email})
        
        if not user:
            logger.error(f"User with email {email} not found")
            return
        
        user_id = str(user.get('_id'))
        logger.info(f"Found user: {email} with ID: {user_id}")
        
        # Check for usage record
        usage_record = await tryon_usage_collection.find_one({"user_id": user_id})
        
        if not usage_record:
            logger.warning(f"No usage record found for user {email}")
            
            # Create a new usage record if requested
            create = input("Create a new usage record for this user? (y/n): ")
            if create.lower() == 'y':
                now = datetime.utcnow()
                new_record = {
                    "user_id": user_id,
                    "daily_count": 0,
                    "total_count": 0,
                    "last_reset": now,
                    "last_used": None
                }
                
                # Insert the new record
                result = await tryon_usage_collection.insert_one(new_record)
                logger.info(f"Created usage record for {email}: {result.inserted_id}")
        else:
            logger.info(f"Usage record found for user {email}:")
            logger.info(f"Daily count: {usage_record.get('daily_count', 0)}")
            logger.info(f"Total count: {usage_record.get('total_count', 0)}")
            logger.info(f"Last used: {usage_record.get('last_used')}")
            logger.info(f"Last reset: {usage_record.get('last_reset')}")
            
    finally:
        # Close the MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "view":
            asyncio.run(view_usage_records())
        elif sys.argv[1] == "fix":
            asyncio.run(create_missing_usage_records())
        elif sys.argv[1] == "check" and len(sys.argv) > 2:
            asyncio.run(check_specific_user(sys.argv[2]))
        else:
            print("Usage:")
            print("  python fix_usage_records.py view    - View all usage records")
            print("  python fix_usage_records.py fix     - Create missing usage records")
            print("  python fix_usage_records.py check <email> - Check usage for specific user")
    else:
        print("Usage:")
        print("  python fix_usage_records.py view    - View all usage records")
        print("  python fix_usage_records.py fix     - Create missing usage records")
        print("  python fix_usage_records.py check <email> - Check usage for specific user") 