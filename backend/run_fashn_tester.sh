#!/bin/bash

# Run the simplified FASHN.ai API tester interface
echo "Making sure dependencies are installed..."
pip install -r requirements_fashn_tester.txt

echo "Checking if backend server is running..."

# Function to start the backend server
start_backend_server() {
  echo "Starting backend server with proper working directory..."
  # Start the server with proper working directory
  cd "$(dirname "$0")" # Ensure we're in the backend directory
  
  # Check if MongoDB is running (required for backend server)
  if nc -z localhost 27017 2>/dev/null; then
    echo "MongoDB is running"
  else
    echo "⚠️ Warning: MongoDB doesn't appear to be running. Backend will fail if it needs the database."
  fi
  
  # Start server in background
  echo "Starting backend server..."
  python -m uvicorn main:app --reload > ./backend_server.log 2>&1 &
  BACKEND_PID=$!
  echo "Backend server started with PID: $BACKEND_PID"
  
  # Wait for server to become available
  echo "Waiting for server to become available..."
  for i in {1..15}; do
    if curl -s http://localhost:8000/health > /dev/null; then
      echo "✅ Backend server is now running"
      break
    fi
    
    # Check if process is still running
    if ! ps -p $BACKEND_PID > /dev/null; then
      echo "❌ Backend process died. Check backend_server.log for details"
      cat backend_server.log | tail -n 20
      exit 1
    fi
    
    echo "Still waiting... ($i/15)"
    sleep 2
  done
}

# Try to check if server is running
if curl -s http://localhost:8000/health > /dev/null; then
  echo "✅ Backend server is already running"
else
  echo "Backend server not responding to health check"
  
  # Check if something is using port 8000
  if lsof -i :8000 >/dev/null 2>&1; then
    echo "⚠️ Something is using port 8000 but not responding to health check"
    echo "You may need to restart the backend server manually"
  else
    echo "Port 8000 is available, starting backend server..."
    start_backend_server
  fi
fi

# Make sure .env file exists and contains FASHN_API_KEY
if [ -f ".env" ]; then
  if grep -q "FASHN_API_KEY" .env; then
    echo "✅ Found FASHN_API_KEY in .env file"
  else
    echo "⚠️ WARNING: No FASHN_API_KEY found in .env file. The backend may not be able to connect to FASHN API."
  fi
else
  echo "⚠️ WARNING: No .env file found. Create one with FASHN_API_KEY=your_api_key"
fi

echo "Starting simplified FASHN.ai API tester..."
python fashn_test.py

# If you need to add an API key directly, uncomment and modify:
# FASHN_API_KEY="your_api_key_here" python fashn_test.py

echo "Done!" 