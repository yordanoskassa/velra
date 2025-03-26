# Docker Instructions for Market Breakdown Backend

This document provides instructions for building, deploying, and managing the Docker image for the Market Breakdown backend.

## Prerequisites

- Docker installed on your system
- Docker Compose installed on your system (for development)

## Development Setup

For development, you can use Docker Compose to run the backend with a MongoDB instance:

```bash
# Start the backend and MongoDB
cd backend
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the services
docker-compose down
```

## Building the Docker Image

To build the Docker image:

```bash
# Make the script executable (if not already)
chmod +x build-and-push.sh

# Run the build script
./build-and-push.sh
```

This will create a Docker image with the name `market-breakdown-backend` and tag it with the current timestamp and `latest`.

## Deploying the Backend

To deploy the backend:

```bash
# Make the script executable (if not already)
chmod +x deploy.sh

# Run the deploy script
./deploy.sh
```

This will:
1. Create a Docker network if it doesn't exist
2. Stop and remove any existing container with the same name
3. Start a new container with the latest image

### Using a Different Port

If port 8000 is already in use, you can specify a different port:

```bash
# Deploy using port 8001
./deploy.sh 8001
```

The script will also automatically detect if the default port (8000) is in use and offer to use the next available port.

### Force Mode

If you want to forcefully kill any process using port 8000 (or your specified port):

```bash
# Force kill any process using port 8000 and deploy
./deploy.sh 8000 force

# Force kill any process using port 8001 and deploy on that port
./deploy.sh 8001 force
```

Use this option with caution as it will terminate any process using the specified port without confirmation.

## Environment Variables

The backend requires several environment variables to be set. These can be provided in a `.env` file:

- `MONGODB_URL`: MongoDB connection string
- `DB_NAME`: Database name
- `JWT_SECRET`: Secret key for JWT token generation
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time in minutes
- `RAPIDAPI_KEY`: API key for RapidAPI
- `RAPIDAPI_HOST`: Host for RapidAPI

## Manual Docker Commands

If you prefer to run Docker commands manually:

```bash
# Build the image
docker build -t market-breakdown-backend:latest .

# Run the container
docker run -d \
  --name market-breakdown-backend \
  -p 8000:8000 \
  --env-file .env \
  --restart unless-stopped \
  market-breakdown-backend:latest

# Run on a different port (e.g., 8001)
docker run -d \
  --name market-breakdown-backend \
  -p 8001:8000 \
  --env-file .env \
  --restart unless-stopped \
  market-breakdown-backend:latest

# View logs
docker logs -f market-breakdown-backend

# Stop and remove the container
docker stop market-breakdown-backend
docker rm market-breakdown-backend
```

## Production Deployment

For production deployment, consider:

1. Using a container orchestration platform like Kubernetes
2. Setting up proper monitoring and logging
3. Using a CI/CD pipeline to automate builds and deployments
4. Securing your environment variables
5. Setting up proper networking and security rules

## Troubleshooting

If you encounter issues:

1. Check the container logs: `docker logs -f market-breakdown-backend`
2. Verify environment variables are correctly set
3. Ensure MongoDB is accessible from the container
4. Check network connectivity between services
5. If you get a "port is already allocated" error:
   - Use a different port: `./deploy.sh 8001`
   - Use force mode to kill the process using the port: `./deploy.sh 8000 force` 