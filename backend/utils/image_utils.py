import base64
import time
from fastapi import UploadFile
import logging
logger = logging.getLogger(__name__)

async def encode_image_to_base64(file: UploadFile) -> str:
    """
    Encode an uploaded image file to base64 format.
    
    Args:
        file: The uploaded file object
        
    Returns:
        Base64-encoded data URI string compatible with FASHN API
    """
    start_time = time.monotonic()
    
    if not file or not hasattr(file, 'read'):
        logger.error(f"Invalid file object passed to encode_image_to_base64: {type(file).__name__}")
        raise ValueError(f"Invalid file object: {type(file).__name__}")
    
    # Set a maximum size for images to prevent processing extremely large files
    MAX_SIZE_MB = 10
    MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
    
    try:
        # If it's a starlette UploadFile, we need to read it differently
        if hasattr(file, 'file'):
            # Read file content directly into memory with size limit
            contents = await file.read(MAX_SIZE_BYTES + 1)  # Read one extra byte to check if file is too large
        else:
            # It might be a regular file-like object
            contents = file.read(MAX_SIZE_BYTES + 1)
    
        # Check if file is too large
        if len(contents) > MAX_SIZE_BYTES:
            logger.warning(f"Image too large: {len(contents) / (1024 * 1024):.2f} MB, max allowed: {MAX_SIZE_MB} MB")
            raise ValueError(f"Image file too large (max {MAX_SIZE_MB}MB allowed)")
    
        read_time = time.monotonic() - start_time
        logger.info(f"File read time: {read_time:.4f}s, size: {len(contents) / 1024:.2f} KB")
    
        # Encode to base64
        encode_start = time.monotonic()
        encoded = base64.b64encode(contents).decode("utf-8")
        encode_time = time.monotonic() - encode_start
        logger.info(f"Base64 encode time: {encode_time:.4f}s, encoded size: {len(encoded)} bytes")
    
        # Form data URI with mime type - FASHN API requires the full data URI format
        mime_type = file.content_type or "image/jpeg"
        data_uri = f"data:{mime_type};base64,{encoded}"
    
        total_time = time.monotonic() - start_time
        logger.info(f"Total encode_image_to_base64 time: {total_time:.4f}s")
    
        # Return the full data URI - this is what FASHN API expects per documentation
        return data_uri
    except Exception as e:
        logger.error(f"Error encoding image to base64: {str(e)}")
        raise ValueError(f"Failed to encode image: {str(e)}")
    finally:
        # Reset file pointer for potential future reads
        # Only if it's a real file object
        if hasattr(file, 'seek'):
            try:
                await file.seek(0) if hasattr(file.seek, '__await__') else file.seek(0)
            except Exception as e:
                logger.warning(f"Could not reset file pointer: {str(e)}") 