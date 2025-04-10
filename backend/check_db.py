import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pprint import pprint

async def check_db():
    # Connect to MongoDB
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.velra
    
    # List all collections
    collections = await db.list_collection_names()
    print("Collections:", collections)
    
    # Check for user
    users = db.users
    user_doc = await users.find_one({"email": "jordan.kebede72@gmail.com"})
    if user_doc:
        print("\nFound user:")
        user_id = user_doc.get("_id")
        print(f"User ID: {user_id}")
        
        # Check tryon_usage collection
        tryon_usage = db.tryon_usage
        usage_doc = await tryon_usage.find_one({"user_id": str(user_id)})
        print("\nTry-on usage record:")
        pprint(usage_doc)
    else:
        print("User not found")

if __name__ == "__main__":
    asyncio.run(check_db()) 