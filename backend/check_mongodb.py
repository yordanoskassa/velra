import sys
import pymongo
from datetime import datetime
from bson import ObjectId

# NOTE: To install required packages:
# pip install pymongo[srv] dnspython

def connect_to_db():
    """Connect to MongoDB Atlas database"""
    try:
        # Use your actual MongoDB connection string from .env 
        connection_string = "mongodb+srv://kassay:BdyQyJWbTVH3l6K1@cluster1.gep2t.mongodb.net"
        client = pymongo.MongoClient(connection_string)
        db = client.velra
        print(f"Connected to MongoDB Atlas, database: velra")
        return client, db
    except Exception as e:
        print(f"Could not connect to MongoDB: {e}")
        raise

def check_collections():
    """List collections in the database"""
    client, db = connect_to_db()
    try:
        print("Collections in database:")
        for collection in db.list_collection_names():
            print(f"- {collection}")
    finally:
        client.close()

def check_user(email):
    """Check user by email and their try-on usage"""
    client, db = connect_to_db()
    try:
        # Find user
        user = db.users.find_one({"email": email})
        if not user:
            print(f"User with email {email} not found")
            return
            
        user_id = user.get("_id")
        print(f"\nFound user:")
        print(f"User ID: {user_id}")
        print(f"Email: {user.get('email')}")
        print(f"Name: {user.get('name')}")
        print(f"Is Premium: {user.get('is_premium', False)}")
        print(f"Created: {user.get('created_at')}")
        
        # Check tryon_usage
        usage_record = db.tryon_usage.find_one({"user_id": str(user_id)})
        print("\nTry-on usage record:")
        print(usage_record)
        
        if not usage_record:
            create = input("Create a new usage record for this user? (y/n): ")
            if create.lower() == 'y':
                now = datetime.utcnow()
                new_record = {
                    "user_id": str(user_id),
                    "daily_count": 0, 
                    "total_count": 0,
                    "last_reset": now,
                    "last_used": None
                }
                result = db.tryon_usage.insert_one(new_record)
                print(f"Created usage record with id: {result.inserted_id}")
    finally:
        client.close()

def fix_all_users():
    """Create try-on usage records for all users who don't have one"""
    client, db = connect_to_db()
    try:
        # Find all users
        users = list(db.users.find({}))
        print(f"Found {len(users)} users")
        
        # Process each user
        for user in users:
            user_id = str(user.get("_id"))
            email = user.get("email", "unknown")
            
            # Check if user has a usage record
            usage = db.tryon_usage.find_one({"user_id": user_id})
            
            if not usage:
                print(f"Creating usage record for {email} ({user_id})")
                now = datetime.utcnow()
                new_record = {
                    "user_id": user_id,
                    "daily_count": 0,
                    "total_count": 0,
                    "last_reset": now,
                    "last_used": None
                }
                db.tryon_usage.insert_one(new_record)
            else:
                print(f"User {email} already has usage record")
    finally:
        client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python check_mongodb.py collections - List all collections")
        print("  python check_mongodb.py user email@example.com - Check user and their try-on usage")
        print("  python check_mongodb.py fix - Create try-on usage records for all users")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "collections":
        check_collections()
    elif command == "user" and len(sys.argv) > 2:
        check_user(sys.argv[2])
    elif command == "fix":
        fix_all_users()
    else:
        print("Unknown command.")
        print("Usage:")
        print("  python check_mongodb.py collections - List all collections")
        print("  python check_mongodb.py user email@example.com - Check user and their try-on usage")
        print("  python check_mongodb.py fix - Create try-on usage records for all users") 