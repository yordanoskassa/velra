import base64
import logging
import time
import uuid
import httpx
from typing import Optional, Tuple, Dict, Any, Union
from config import settings
from fastapi import UploadFile
import aiofiles
import os

# Configure logging
logger = logging.getLogger(__name__)

# Flag to track if Cloudinary is initialized
is_initialized = False

def initialize_cloudinary() -> bool:
    """
    Initialize the Cloudinary configuration if credentials are provided.
    Returns True if initialized successfully, False otherwise.
    """
    global is_initialized
    
    if is_initialized:
        return True
        
    if not all([
        settings.CLOUDINARY_CLOUD_NAME,
        settings.CLOUDINARY_API_KEY,
        settings.CLOUDINARY_API_SECRET
    ]):
        logger.warning("Cloudinary credentials not fully configured. Skipping initialization.")
        return False
        
    logger.info("Cloudinary credentials found. Ready to use Cloudinary for temporary storage.")
    is_initialized = True
    return True

async def upload_image_to_cloudinary(
    image_data: Union[str, bytes, UploadFile], 
    folder: str = "temp_tryon",
    public_id: Optional[str] = None
) -> Tuple[bool, Dict[str, Any]]:
    """
    Upload an image to Cloudinary
    
    Args:
        image_data: Base64 image data, URL, binary data, or UploadFile object
        folder: Cloudinary folder to store the image
        public_id: Optional public ID for the image
        
    Returns:
        Tuple of (success, result_dict)
    """
    if not initialize_cloudinary():
        logger.error("Cloudinary not initialized - missing credentials in environment variables")
        return False, {"error": "Cloudinary not initialized - check your environment variables"}
    
    try:
        # Generate a unique ID if not provided
        if not public_id:
            public_id = f"tryon_{uuid.uuid4().hex[:10]}_{int(time.time())}"
        
        # Create a temp file path for storing the image if needed
        temp_file_path = None
        base64_data = None
        
        # Handle different types of image_data
        if isinstance(image_data, UploadFile):
            logger.info(f"Processing UploadFile: {image_data.filename}")
            # Create a temporary file
            temp_file_path = f"/tmp/{uuid.uuid4().hex}_{image_data.filename}"
            
            # Save the uploaded file content to the temporary file
            async with aiofiles.open(temp_file_path, 'wb') as out_file:
                # Read the file in chunks to avoid memory issues with large files
                while content := await image_data.read(1024 * 1024):  # 1MB chunks
                    await out_file.write(content)
            
            # Read the file back for upload
            async with aiofiles.open(temp_file_path, 'rb') as in_file:
                file_content = await in_file.read()
                base64_data = base64.b64encode(file_content).decode('ascii')
                
            logger.info(f"Converted UploadFile to base64 data ({len(base64_data)} chars)")
            
        elif isinstance(image_data, str):
            if image_data.startswith('data:'):
                image_type = "data URI"
                prefix = image_data.split(';')[0] if ';' in image_data else "unknown"
                size = len(image_data)
                logger.info(f"Processing {image_type} ({prefix}, {size} bytes) for Cloudinary upload")
                
                # Use the data URI directly
                base64_data = image_data.split(',', 1)[1] if ',' in image_data else image_data
            elif image_data.startswith('http'):
                image_type = "URL"
                logger.info(f"Processing external {image_type}: {image_data[:50]}...")
                
                # For URLs, we'll pass the URL directly to Cloudinary
                base64_data = None  # We'll use the URL directly in the data payload
            else:
                image_type = "raw base64"
                size = len(image_data)
                logger.info(f"Processing {image_type} data ({size} bytes) for Cloudinary upload")
                
                # Use the raw base64 data
                base64_data = image_data
        elif isinstance(image_data, bytes):
            logger.info(f"Processing binary data ({len(image_data)} bytes) for Cloudinary upload")
            
            # Convert binary data to base64
            base64_data = base64.b64encode(image_data).decode('ascii')
        else:
            logger.warning(f"Unexpected image_data type: {type(image_data).__name__}")
            return False, {"error": f"Unsupported image data type: {type(image_data).__name__}"}
            
        # Prepare upload parameters
        upload_url = f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/upload"
        timestamp = int(time.time())
        
        # Prepare form data based on the type of image data
        data = {
            "api_key": settings.CLOUDINARY_API_KEY,
            "timestamp": timestamp,
            "folder": folder,
            "public_id": public_id,
            "overwrite": True
        }
        
        # Add the file data
        if isinstance(image_data, str) and image_data.startswith('http'):
            # For external URLs, use the URL directly
            data["file"] = image_data
        else:
            # For processed data, use the base64 data
            data["file"] = f"data:image/jpeg;base64,{base64_data}"
        
        # Create signature
        import hashlib
        import hmac
        
        params_to_sign = "&".join([f"{k}={v}" for k, v in sorted(data.items()) if k != "file"])
        params_to_sign += f"&timestamp={timestamp}"
        
        try:
            signature = hmac.new(
                settings.CLOUDINARY_API_SECRET.encode('utf-8'),
                params_to_sign.encode('utf-8'),
                hashlib.sha1
            ).hexdigest()
            
            data["signature"] = signature
        except Exception as sig_error:
            logger.error(f"Error creating Cloudinary signature: {str(sig_error)}")
            return False, {"error": f"Signature creation failed: {str(sig_error)}"}
        
        # Make the upload request
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"Uploading image to Cloudinary with public_id: {public_id}")
            
            try:
                response = await client.post(upload_url, data=data)
                
                logger.info(f"Cloudinary API response status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"Successfully uploaded image to Cloudinary: {result.get('secure_url')}")
                    logger.info(f"Image format: {result.get('format')}, Size: {result.get('bytes')} bytes, Dimensions: {result.get('width')}x{result.get('height')}")
                    return True, result
                else:
                    error_text = response.text
                    try:
                        error_json = response.json()
                        if isinstance(error_json, dict):
                            error_text = error_json.get('error', {}).get('message', error_text)
                    except:
                        pass
                        
                    logger.error(f"Failed to upload to Cloudinary: {response.status_code}, {error_text}")
                    return False, {
                        "error": f"Cloudinary upload failed with status {response.status_code}",
                        "details": error_text
                    }
            except httpx.TimeoutException as timeout_err:
                logger.error(f"Timeout uploading to Cloudinary: {str(timeout_err)}")
                return False, {"error": f"Upload timeout: {str(timeout_err)}"}
            except httpx.NetworkError as network_err:
                logger.error(f"Network error uploading to Cloudinary: {str(network_err)}")
                return False, {"error": f"Network error: {str(network_err)}"}
            finally:
                # Clean up the temporary file if it was created
                if temp_file_path and os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                        logger.info(f"Removed temporary file: {temp_file_path}")
                    except Exception as e:
                        logger.warning(f"Failed to remove temporary file {temp_file_path}: {str(e)}")
                
    except Exception as e:
        logger.error(f"Error uploading image to Cloudinary: {str(e)}", exc_info=True)
        return False, {"error": str(e)}

async def delete_image_from_cloudinary(public_id: str, folder: str = "temp_tryon") -> bool:
    """
    Delete an image from Cloudinary
    
    Args:
        public_id: The public ID of the image
        folder: The folder where the image is stored
        
    Returns:
        True if deleted successfully, False otherwise
    """
    if not initialize_cloudinary():
        logger.error("Cloudinary not initialized - missing credentials in environment variables")
        return False
    
    try:
        # Prepare the full public_id including folder
        full_public_id = f"{folder}/{public_id}" if folder else public_id
        
        # Prepare deletion parameters
        delete_url = f"https://api.cloudinary.com/v1_1/{settings.CLOUDINARY_CLOUD_NAME}/image/destroy"
        timestamp = int(time.time())
        
        # Create signature
        import hashlib
        import hmac
        
        try:
            params_to_sign = f"public_id={full_public_id}&timestamp={timestamp}{settings.CLOUDINARY_API_SECRET}"
            signature = hashlib.sha1(params_to_sign.encode('utf-8')).hexdigest()
        except Exception as sig_error:
            logger.error(f"Error creating Cloudinary deletion signature: {str(sig_error)}")
            return False
        
        # Prepare data
        data = {
            "public_id": full_public_id,
            "api_key": settings.CLOUDINARY_API_KEY,
            "timestamp": timestamp,
            "signature": signature
        }
        
        # Make the delete request
        async with httpx.AsyncClient(timeout=15.0) as client:
            logger.info(f"Deleting image from Cloudinary with public_id: {full_public_id}")
            
            try:
                response = await client.post(delete_url, data=data)
                
                logger.info(f"Cloudinary delete API response status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    if result.get("result") == "ok":
                        logger.info(f"Successfully deleted image from Cloudinary: {full_public_id}")
                        return True
                    else:
                        error_message = result.get("error", {}).get("message", "Unknown error")
                        logger.warning(f"Cloudinary returned non-ok result: {result}, Error: {error_message}")
                        return False
                else:
                    error_text = response.text
                    try:
                        error_json = response.json()
                        if isinstance(error_json, dict):
                            error_text = error_json.get('error', {}).get('message', error_text)
                    except:
                        pass
                        
                    logger.error(f"Failed to delete from Cloudinary: {response.status_code}, {error_text}")
                    return False
            except httpx.TimeoutException as timeout_err:
                logger.error(f"Timeout deleting from Cloudinary: {str(timeout_err)}")
                return False
            except httpx.NetworkError as network_err:
                logger.error(f"Network error deleting from Cloudinary: {str(network_err)}")
                return False
                
    except Exception as e:
        logger.error(f"Error deleting image from Cloudinary: {str(e)}", exc_info=True)
        return False 