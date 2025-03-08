#!/bin/bash
set -e

# Configuration
IMAGE_NAME="market-breakdown-backend"
VERSION=$(date +"%Y%m%d%H%M%S")
DOCKER_REGISTRY="your-registry" # Replace with your Docker registry (e.g., Docker Hub username)

# Build the Docker image
echo "Building Docker image: $IMAGE_NAME:$VERSION"
docker build -t $IMAGE_NAME:$VERSION .
docker tag $IMAGE_NAME:$VERSION $IMAGE_NAME:latest

# Optional: Push to Docker registry
# Uncomment the following lines if you want to push to a registry
# echo "Pushing Docker image to registry: $DOCKER_REGISTRY/$IMAGE_NAME:$VERSION"
# docker tag $IMAGE_NAME:$VERSION $DOCKER_REGISTRY/$IMAGE_NAME:$VERSION
# docker tag $IMAGE_NAME:$VERSION $DOCKER_REGISTRY/$IMAGE_NAME:latest
# docker push $DOCKER_REGISTRY/$IMAGE_NAME:$VERSION
# docker push $DOCKER_REGISTRY/$IMAGE_NAME:latest

echo "Docker image built successfully: $IMAGE_NAME:$VERSION"
echo "To run the image locally:"
echo "docker run -p 8000:8000 --env-file .env $IMAGE_NAME:latest" 