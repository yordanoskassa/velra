#!/bin/bash
set -e

# Print environment for debugging (remove in production)
echo "Starting backend with the following configuration:"
echo "MONGODB_URL: $MONGODB_URL"
echo "DB_NAME: $DB_NAME"
echo "Environment variables from .env file should be loaded above"
echo "If MONGODB_URL is still showing mongodb://mongodb:27017, the .env file is not being loaded correctly"

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."
MAX_RETRIES=30
RETRY_INTERVAL=2
RETRIES=0

# Check if we're using a remote MongoDB instance
if [[ $MONGODB_URL == mongodb+srv://* ]]; then
    echo "Using remote MongoDB instance. Skipping connection check."
else
    # Use mongosh if available, otherwise use a simple connection check
    until nc -z mongodb 27017 || [ $RETRIES -eq $MAX_RETRIES ]; do
        RETRIES=$((RETRIES+1))
        if [ $RETRIES -eq $MAX_RETRIES ]; then
            echo "Error: Could not connect to MongoDB after $MAX_RETRIES retries"
            exit 1
        fi
        echo "MongoDB not ready yet, retrying in $RETRY_INTERVAL seconds... (Attempt $RETRIES/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done
    echo "MongoDB is ready!"
fi

# Start the application
echo "Starting the application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload 