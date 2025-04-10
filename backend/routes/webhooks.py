from fastapi import APIRouter, HTTPException, Request, Depends, status
from database import get_mongodb_connection
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel
import hmac
import hashlib
from config import settings

# Create router
router = APIRouter(
    prefix="/webhooks",
    tags=["webhooks"],
)

# Configure logging
logger = logging.getLogger(__name__)

# RevenueCat webhook payload models
class RevenueWebhookEvent(BaseModel):
    event: dict
    api_version: str


# Verify RevenueCat webhook signature
async def verify_revenuecat_signature(request: Request) -> bool:
    """
    Verify that the webhook request is coming from RevenueCat.
    Uses the RevenueCat webhook signature verification.
    """
    # Get RevenueCat webhook secret from settings
    webhook_secret = settings.REVENUECAT_WEBHOOK_SECRET

    # If no secret is configured, skip verification in development
    if not webhook_secret:
        logger.warning("RevenueCat webhook secret not configured. Skipping signature verification.")
        return True

    # Get the signature from header
    signature = request.headers.get("X-RevenueCat-Signature")
    if not signature:
        logger.error("Missing RevenueCat signature header")
        return False

    # Get the request body
    body = await request.body()
    body_str = body.decode("utf-8")

    # Calculate expected signature
    expected_signature = hmac.new(
        webhook_secret.encode(),
        body_str.encode(),
        hashlib.sha256
    ).hexdigest()

    # Compare signatures
    if signature != expected_signature:
        logger.error(f"Invalid RevenueCat signature: {signature}, expected: {expected_signature}")
        return False

    return True


@router.post("/revenuecat")
async def revenuecat_webhook(request: Request):
    """
    Handle RevenueCat webhooks for subscription events.
    
    This endpoint receives webhook events from RevenueCat when subscription 
    status changes, such as:
    - initial_purchase
    - renewal
    - cancellation
    - expiration
    - etc.
    
    It updates the user's isPremium status in the database accordingly.
    """
    # Verify webhook signature in production
    is_valid = await verify_revenuecat_signature(request)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    
    # Parse webhook payload
    try:
        body = await request.body()
        payload = json.loads(body)
        logger.info(f"Received RevenueCat webhook: {payload.get('event', {}).get('type', 'unknown')}")

        # Extract event data
        event_type = payload.get("event", {}).get("type")
        if not event_type:
            raise HTTPException(status_code=400, detail="Missing event type")

        # Get event data
        event_data = payload.get("event", {})
        
        # Get app_user_id - this should match your user ID in the database
        app_user_id = event_data.get("app_user_id")
        if not app_user_id:
            logger.warning("No app_user_id in webhook payload")
            return {"status": "ignored", "reason": "no_user_id"}
            
        # If this is a test event, log it but don't process further
        if event_data.get("is_sandbox_event", False):
            logger.info(f"Received sandbox event for user {app_user_id}: {event_type}")
            return {"status": "acknowledged", "is_sandbox": True}
            
        # Get product ID/entitlement info
        entitlements = event_data.get("entitlements", {})
        
        # Initialize MongoDB connection
        db = await get_mongodb_connection()
        users_collection = db["users"]
        
        # Determine if user should be premium based on event type and entitlements
        should_be_premium = False
        
        # Handle different event types
        if event_type in ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE"]:
            # User has an active subscription - set premium to true
            should_be_premium = True
            
            # Also record subscription details if needed
            subscription_details = {
                "product_id": event_data.get("product_id"),
                "expires_date": event_data.get("expires_date"),
                "purchase_date": event_data.get("purchase_date"),
                "subscription_id": event_data.get("subscription_id"),
                "entitlements": list(entitlements.keys()),
                "updated_at": datetime.utcnow()
            }
            
            # Update user subscription details
            result = await users_collection.update_one(
                {"revenuecat_id": app_user_id},  # Use your actual user id field here
                {
                    "$set": {
                        "isPremium": True,
                        "subscription": subscription_details
                    }
                }
            )
            
            logger.info(f"User {app_user_id} marked as premium: {result.modified_count} documents modified")
            
        elif event_type in ["CANCELLATION", "EXPIRATION", "BILLING_ISSUE"]:
            # User's subscription has ended - set premium to false
            should_be_premium = False
            
            # Update user subscription status
            result = await users_collection.update_one(
                {"revenuecat_id": app_user_id},  # Use your actual user id field here
                {
                    "$set": {
                        "isPremium": False,
                        "subscription.status": "expired", 
                        "subscription.expires_date": event_data.get("expires_date"),
                        "subscription.updated_at": datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"User {app_user_id} marked as non-premium: {result.modified_count} documents modified")
        
        # Return success response
        return {
            "status": "success", 
            "event_type": event_type,
            "user_updated": True,
            "is_premium": should_be_premium
        }
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON in webhook payload")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    except Exception as e:
        logger.error(f"Error processing RevenueCat webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing webhook: {str(e)}") 