# Cloudinary Integration for Virtual Try-On

This feature provides temporary image storage using Cloudinary for the virtual try-on functionality. 

## Why Use Cloudinary?

The FASHN API sometimes has issues with processing base64-encoded images directly. By using Cloudinary as an intermediary:

1. Images are properly validated and processed before being sent to FASHN
2. The API receives standard image URLs instead of large base64 strings
3. Debugging is easier as you can inspect the problematic images directly
4. Network transmission is more efficient

## Setup

1. Create a Cloudinary account at [cloudinary.com](https://cloudinary.com)
2. Get your Cloud Name, API Key, and API Secret from your Cloudinary dashboard
3. Add these values to your environment variables in your `.env` file:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
USE_CLOUDINARY_FOR_TRYON=true
```

## How It Works

1. When an image is uploaded for virtual try-on:
   - The image is processed and validated
   - If `USE_CLOUDINARY_FOR_TRYON` is enabled, the image is uploaded to Cloudinary
   - The base64 data is replaced with the Cloudinary URL in the FASHN API request
   - After processing, the temporary image is automatically deleted from Cloudinary

2. Benefits:
   - Reduced payload size in API requests
   - Better compatibility with the FASHN API
   - Automatic cleanup of temporary images
   - More reliable image processing

## Troubleshooting

If you encounter issues:

1. Check your Cloudinary dashboard to ensure your account is active
2. Verify that your API credentials are correct in the `.env` file
3. Look for Cloudinary-related errors in the application logs
4. Temporarily disable the feature by setting `USE_CLOUDINARY_FOR_TRYON=false` to compare behavior

## Security

- All images are stored in a "temp_tryon" folder in your Cloudinary account
- Images are automatically deleted after processing
- No permanent storage of user images occurs
- All API requests use secure HTTPS connections 