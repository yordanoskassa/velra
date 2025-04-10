#!/bin/bash

# Set the API URL to the Docker backend
export API_URL=http://localhost:8000

# Start the Expo development server
echo "Starting Expo with API_URL=$API_URL"
npx expo start 