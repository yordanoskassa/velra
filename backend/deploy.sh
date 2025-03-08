#!/bin/bash
set -e

# Configuration
IMAGE_NAME="market-breakdown-backend"
CONTAINER_NAME="market-breakdown-backend"
NETWORK_NAME="market-breakdown-network"
HOST_PORT=${1:-8000}  # Use first argument as port or default to 8000
CONTAINER_PORT=8000

# Check if the specified port is already in use
if lsof -Pi :$HOST_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "Warning: Port $HOST_PORT is already in use!"
    echo "You can specify a different port by running: ./deploy.sh <port_number>"
    echo "For example: ./deploy.sh 8001"
    
    # Ask if the user wants to continue with a different port
    read -p "Would you like to try port $((HOST_PORT+1)) instead? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        HOST_PORT=$((HOST_PORT+1))
        echo "Using port $HOST_PORT instead."
    else
        echo "Deployment aborted. Please free up port $HOST_PORT or specify a different port."
        exit 1
    fi
fi

# Check if the network exists, create it if it doesn't
if ! docker network inspect $NETWORK_NAME >/dev/null 2>&1; then
    echo "Creating Docker network: $NETWORK_NAME"
    docker network create $NETWORK_NAME
fi

# Stop and remove existing container if it exists
if docker ps -a | grep -q $CONTAINER_NAME; then
    echo "Stopping and removing existing container: $CONTAINER_NAME"
    docker stop $CONTAINER_NAME || true
    docker rm $CONTAINER_NAME || true
fi

# Run the container
echo "Starting container: $CONTAINER_NAME on port $HOST_PORT"
docker run -d \
    --name $CONTAINER_NAME \
    --network $NETWORK_NAME \
    -p $HOST_PORT:$CONTAINER_PORT \
    --env-file .env \
    --restart unless-stopped \
    $IMAGE_NAME:latest

echo "Container started successfully: $CONTAINER_NAME"
echo "API is available at: http://localhost:$HOST_PORT"
echo "To view logs: docker logs -f $CONTAINER_NAME" 