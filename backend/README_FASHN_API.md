# VELRA Virtual Try-On Tester (Using Backend)

This Gradio interface allows you to test the FASHN.ai API through the local backend server.

## Overview

The FASHN.ai API offers virtual try-on capabilities that are integrated into your VELRA backend application. This Gradio interface provides a simple way to test this functionality using your existing backend infrastructure.

## Key Features

- Test the virtual try-on feature through your local backend server
- Upload your own model and garment images
- **Capture model images directly from your webcam**
- Uses the same API key from your backend configuration
- Track usage with device IDs
- View try-on results directly in the interface

## How It Works

Instead of calling the FASHN.ai API directly, this tester:
1. Sends images to your local backend server (http://localhost:8000)
2. The backend uses your configured API key from the .env file
3. The backend handles the API requests to FASHN.ai
4. Results are returned through the same backend server

## Requirements

- Python 3.7+
- Gradio
- Requests
- PIL (Pillow)
- Your backend server must be running at http://localhost:8000
- Your backend must have FASHN_API_KEY configured in .env

## Running the Interface

1. Make sure your backend server is running at http://localhost:8000
2. Navigate to the backend directory
3. Run the script:

```bash
./run_fashn_tester.sh
```

Alternatively, run directly with Python:

```bash
python fashn_test.py
```

## Using the Interface

1. Open the interface in your web browser (usually at http://localhost:7860)
2. **Upload or capture a model image (person):**
   - Click "Upload" to select an image file from your computer
   - Or click "Webcam" to capture an image using your camera
3. **Upload a garment image (clothing):**
   - Click "Upload" to select an image file from your computer
4. Verify that both images appear in their respective preview areas
5. Optionally, enter a device ID or leave blank to auto-generate
6. Configure additional parameters if needed
7. Click "Try It On!"
8. Wait for the result (can take up to 40-60 seconds)

## Device ID Tracking

The interface uses device IDs to track usage limits. You can:

- Enter a specific device ID for testing
- Leave it blank to auto-generate a device ID based on your machine
- Set an environment variable `DEVICE_ID` to use a consistent ID across sessions

## Troubleshooting

If you encounter any issues:

- Ensure your backend server is running (check the "Backend Status" indicator)
- Ensure both model and garment images are uploaded
- Verify your backend has FASHN_API_KEY configured in the .env file
- Check the console output for detailed error messages

## API Documentation

For full documentation of the FASHN.ai API, see:
https://api.fashn.ai/docs 