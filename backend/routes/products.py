from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Any, Dict
import requests
import logging
from pydantic import BaseModel, Field
from config import settings
import datetime
from database import get_mongodb_connection # Import the MongoDB connection utility

# Set up logging
logger = logging.getLogger(__name__)

# Define the cache collection name
PRODUCTS_CACHE_COLLECTION = "products_cache"
CACHE_DURATION_DAYS = 7 # Cache products for 7 days

# Create router
router = APIRouter(
    prefix="/products",
    tags=["Products"],
)

# Simplified Models for the new endpoint - Structure is uncertain!
# We need to inspect the actual API response to refine these.
class SimpleProductPrice(BaseModel):
    # Assuming a simple structure for now
    current: Optional[dict] = Field(default_factory=dict)

class SimpleProduct(BaseModel):
    # Using Any for fields where structure is unknown
    id: Any # ID format might differ
    name: Optional[str] = None
    price: Optional[SimpleProductPrice] = None # Nested structure might differ
    brandName: Optional[str] = None 
    imageUrl: Optional[str] = None 
    # Add other likely fields if needed, or keep it minimal
    # Ensure fields match what the /product/bycategory actually returns

# Response wrapper based on documentation
class ASOSResponseWrapper(BaseModel):
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None  # Changed from List to Dict
    error: Optional[str] = None 

class CategoryProductList(BaseModel):
    # Assuming the response might be a list directly, or nested
    # Adjust this based on actual API response
    products: List[SimpleProduct] = Field(default_factory=list)
    # itemCount: Optional[int] = None # If the API provides a count
    
# ASOS API Configuration from settings
ASOS_API_HOST = settings.ASOS_API_HOST
ASOS_API_KEY = settings.ASOS_API_KEY

# Calculate cache expiry threshold - one week
CACHE_EXPIRY_THRESHOLD = datetime.datetime.utcnow() - datetime.timedelta(days=CACHE_DURATION_DAYS)

logger.info(f"Loaded ASOS_API_HOST for Category Search: {ASOS_API_HOST}")

def ensure_https_prefix(url):
    """Ensure URL starts with https://"""
    if url and isinstance(url, str) and not url.startswith(('http://', 'https://')):
        return f"https://{url}"
    return url

def process_product_images(product_data):
    """Process all image URLs in the product data to ensure they have https:// prefix"""
    if not product_data:
        return product_data
        
    # Make a copy to avoid modifying the original
    processed = dict(product_data)
    
    # Process imageUrl
    if 'imageUrl' in processed:
        processed['imageUrl'] = ensure_https_prefix(processed['imageUrl'])
    
    # Process image object if it exists
    if 'image' in processed:
        if isinstance(processed['image'], str):
            processed['image'] = ensure_https_prefix(processed['image'])
        elif isinstance(processed['image'], dict) and 'url' in processed['image']:
            processed['image']['url'] = ensure_https_prefix(processed['image']['url'])
    
    # Process images array if it exists
    if 'images' in processed and isinstance(processed['images'], list):
        processed['images'] = [ensure_https_prefix(img) if isinstance(img, str) else img 
                              for img in processed['images']]
    
    return processed

# Changed endpoint path and response model
@router.get("/by_category", response_model=List[SimpleProduct]) 
async def get_products_by_category(
    # Changed primary parameter to categoryId
    categoryId: str = Query(..., description="ASOS Category ID (e.g., 27108 for womens tops)"),
    # Renamed limit to perPage, changed default
    perPage: int = Query(24, ge=1, le=100, description="Products per page"), 
    # Added page parameter
    page: int = Query(1, ge=1, description="Page number"),
    # Optional parameters from the new API example
    currency: str = Query("USD", description="Currency code"),
    countryISO: str = Query("US", description="Country ISO code")
):
    """
    Search for products from ASOS based on a Category ID.
    Checks MongoDB cache first. If cache is valid, returns cached data.
    Otherwise, fetches from ASOS API, updates cache, and returns data.
    """
    db = await get_mongodb_connection()
    cache_collection = db[PRODUCTS_CACHE_COLLECTION]

    # --- Check Cache ---
    cache_key = f"{categoryId}_{currency}_{countryISO}" # Create a unique key for cache
    cached_data = await cache_collection.find_one({"_id": cache_key})

    if cached_data:
        last_updated = cached_data.get("last_updated")
        if last_updated and last_updated > CACHE_EXPIRY_THRESHOLD:
            logger.info(f"Cache hit for category {categoryId}. Returning cached data.")
            # Process and return cached products
            products_list = cached_data.get("products", [])
            
            # Apply pagination to cached data
            start_idx = (page - 1) * perPage
            end_idx = start_idx + perPage
            paginated_products = products_list[start_idx:end_idx] if products_list else []
            
            # Process all product images to ensure HTTPS
            processed_products = [process_product_images(product) for product in paginated_products]
            
            # Return as SimpleProduct model instances
            try:
                return [SimpleProduct(**product) for product in processed_products]
            except Exception as parse_err:
                logger.warning(f"Error parsing cached product data for {categoryId}: {parse_err}. Falling back to returning raw data.")
                # Return the processed raw data if model conversion fails
                return processed_products
        else:
            logger.info(f"Cache expired for category {categoryId}. Fetching fresh data.")
    else:
        logger.info(f"Cache miss for category {categoryId}. Fetching fresh data.")

    # --- Fetch from API (if cache miss or expired) ---
    logger.debug(f"Using ASOS Host: {ASOS_API_HOST}")
    if not ASOS_API_KEY or not ASOS_API_HOST:
        logger.error("ASOS API Key or Host not configured.")
        raise HTTPException(status_code=500, detail="ASOS API not configured.")
        
    try:
        # Construct the new API URL
        url = f"https://{ASOS_API_HOST}/product/bycategory" 
        
        # Prepare headers (same as before)
        headers = {
            "X-RapidAPI-Key": ASOS_API_KEY,
            "X-RapidAPI-Host": ASOS_API_HOST
        }
        
        # Prepare query parameters for the new endpoint
        params = {
            "categoryId": categoryId,
            "page": str(page), # API expects string
            "perPage": str(perPage), # API expects string
            "currency": currency,
            "countryISO": countryISO,
        }
        
        # Make the API request
        logger.info(f"Calling ASOS Category API URL: {url}")
        logger.info(f"Calling ASOS Category API Headers: {headers}")
        logger.info(f"Calling ASOS Category API Params: {params}")
        response = requests.get(url, headers=headers, params=params)
        
        logger.info(f"ASOS Category API Response Status Code: {response.status_code}")
        
        # Handle specific errors
        if response.status_code == 429:
            logger.error("ASOS API rate limit exceeded.")
            # FALLBACK: Try to load from cache instead of raising
            raise Exception("API rate limit exceeded. Falling back to cache.")
        elif response.status_code == 403:
            logger.error("ASOS API access forbidden.")
            # FALLBACK: Try to load from cache instead of raising
            raise Exception("API access forbidden. Falling back to cache.")
        
        response.raise_for_status() # Raise for other errors
        
        api_response_data = response.json()
        logger.debug(f"ASOS Category API Raw Response (first 500 chars): {str(api_response_data)[:500]}")

        # --- Response Parsing Adjustment --- 
        # Per documentation, response should be in format: { message, data, error }
        api_response = ASOSResponseWrapper(**api_response_data)
        
        # Check for API-level errors
        if api_response.error:
            logger.error(f"ASOS API returned an error: {api_response.error} - {api_response.message}")
            # FALLBACK: Try to load from cache instead of raising
            raise Exception(f"ASOS API error: {api_response.message}. Falling back to cache.")
        
        # The data is an object, not a list directly
        if not api_response.data:
            logger.error(f"ASOS API returned no data")
            # FALLBACK: Try to load from cache instead of raising
            raise Exception("No data in ASOS API response. Falling back to cache.")
        
        # Log the data structure to understand it
        logger.debug(f"ASOS API data structure keys: {api_response.data.keys() if isinstance(api_response.data, dict) else 'not a dict'}")
        
        # Try to find products in the data object - it could be under various keys
        products_list = []
        
        if isinstance(api_response.data, dict):
            # Check for common keys that might contain the products list
            if "products" in api_response.data and isinstance(api_response.data["products"], list):
                products_list = api_response.data["products"]
            elif "items" in api_response.data and isinstance(api_response.data["items"], list):
                products_list = api_response.data["items"]
            elif "results" in api_response.data and isinstance(api_response.data["results"], list):
                products_list = api_response.data["results"]
            else:
                # If we can't find a list of products, log the structure and FALLBACK
                logger.error(f"Could not find products list in data structure: {str(api_response.data)[:500]}")
                raise Exception("Could not locate products list in API response. Falling back to cache.")
        else:
            # Handle unlikely case where data is not a dict
            logger.error(f"Unexpected ASOS data type: {type(api_response.data)}")
            raise Exception(f"Unexpected API response data type: {type(api_response.data)}. Falling back to cache.")
        
        logger.info(f"Found {len(products_list)} products in the response")
        
        # Check if we found any products
        if not products_list:
            logger.warning(f"No products found in response for category {categoryId}")
            # FALLBACK: Try to load from cache instead of returning empty
            raise Exception("No products found in API response. Falling back to cache.")
        
        # Process all products to ensure proper image URLs before caching
        processed_products_for_cache = [process_product_images(product) for product in products_list]
        
        # --- Update Cache ---
        if processed_products_for_cache: # Only cache if we successfully processed some products
            cache_document = {
                "_id": cache_key, # Use the same key
                "categoryId": categoryId,
                "currency": currency,
                "countryISO": countryISO,
                "products": processed_products_for_cache, # Cache the processed data
                "last_updated": datetime.datetime.utcnow()
            }
            try:
                await cache_collection.update_one(
                    {"_id": cache_key},
                    {"$set": cache_document},
                    upsert=True
                )
                logger.info(f"Updated cache for category {categoryId}")
            except Exception as db_err:
                logger.error(f"Failed to update MongoDB cache for category {categoryId}: {db_err}")
                # Don't fail the request if caching fails, just log it.
        
        # Validate and return processed products using the SimpleProduct model
        try:
            return [SimpleProduct(**product) for product in processed_products_for_cache]
        except Exception as parse_err:
            logger.warning(f"Error converting to SimpleProduct models: {parse_err}. Returning raw processed data.")
            return processed_products_for_cache
        
    except Exception as e:
        logger.error(f"API fetch failed or error encountered: {str(e)}. Attempting to load from cache.")
        # FALLBACK: Try to load from cache
        cached_data = await cache_collection.find_one({"_id": cache_key})
        if cached_data:
            last_updated = cached_data.get("last_updated")
            if last_updated and last_updated > CACHE_EXPIRY_THRESHOLD:
                logger.info(f"Fallback cache hit for category {categoryId}. Returning cached data.")
                products_list = cached_data.get("products", [])
                start_idx = (page - 1) * perPage
                end_idx = start_idx + perPage
                paginated_products = products_list[start_idx:end_idx] if products_list else []
                processed_products = [process_product_images(product) for product in paginated_products]
                try:
                    return [SimpleProduct(**product) for product in processed_products]
                except Exception as parse_err:
                    logger.warning(f"Error parsing cached product data for {categoryId} in fallback: {parse_err}. Returning raw data.")
                    return processed_products
            else:
                logger.warning(f"No valid cache available for category {categoryId} during fallback.")
        # If no cache, return empty list or error
        return []


# Add the test endpoint
@router.get("/test", response_model=Dict[str, Any])
async def test_products_api():
    """Test endpoint to check if the products API is running."""
    return {
        "status": "ok",
        "message": "Products API is operational",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

# Add the debug endpoint
@router.get("/debug_category", response_model=Dict[str, Any])
async def debug_category_response(
    categoryId: str = Query(..., description="ASOS Category ID to debug"),
    page: int = Query(1, ge=1),
    perPage: int = Query(24, ge=1, le=100)
):
    """
    Debug endpoint to see the raw response structure from ASOS API.
    """
    if not ASOS_API_KEY or not ASOS_API_HOST:
        raise HTTPException(status_code=500, detail="ASOS API not configured.")
        
    try:
        url = f"https://{ASOS_API_HOST}/product/bycategory"
        headers = {
            "X-RapidAPI-Key": ASOS_API_KEY,
            "X-RapidAPI-Host": ASOS_API_HOST
        }
        params = {
            "categoryId": categoryId,
            "page": str(page),
            "perPage": str(perPage),
            "currency": "USD",
            "countryISO": "US",
        }
        
        logger.info(f"[DEBUG] Calling ASOS API: {url}")
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        # Return the raw response json
        raw_response = response.json()
        return {"raw_response": raw_response}
        
    except Exception as e:
        logger.exception(f"Debug API call failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Debug API call failed: {str(e)}")

# Removed old search_products function if it existed
# Removed mock data functions 