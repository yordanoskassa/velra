"""
Test script for the try-on API
Run this with: python tryon_test.py
"""

import httpx
import os
import asyncio
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_try_on_limit():
    """Test the try-on limit logic"""
    try:
        # First check if the user is subscribed
        device_id = "test_device_123"
        url = "http://localhost:8000/tryon/device-usage"  # Adjust port if needed
        
        # Test with a subscribed user
        logger.info("Testing with a subscribed user...")
        is_subscribed = True
        data = {
            "device_id": device_id,
            "is_subscribed": is_subscribed,
            "app_version": "1.0.0", 
            "device_model": "Test Device",
            "os_version": "1.0.0"
        }
        
        # First try should work
        response = httpx.post(url, json=data)
        logger.info(f"Response: {response.status_code} - {response.text}")
        
        # Test with a non-subscribed user
        logger.info("\nTesting with a non-subscribed user...")
        is_subscribed = False
        data["is_subscribed"] = is_subscribed
        
        # First try should work
        response = httpx.post(url, json=data)
        logger.info(f"First try response: {response.status_code} - {response.text}")
        
        # Second try should show paywall
        response = httpx.post(url, json=data)
        logger.info(f"Second try response: {response.status_code} - {response.text}")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_try_on_limit())
