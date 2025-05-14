import gradio as gr
import requests
import base64
import time
import hashlib
import os
import io
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_BASE_URL = "http://localhost:8000"  # Local backend server
BACKEND_TRYON_API = f"{API_BASE_URL}/virtual-tryon/test"  # Test endpoint
BACKEND_STATUS_API = f"{API_BASE_URL}/virtual-tryon/test-status"  # Status endpoint

def generate_device_id():
    """Generate a persistent device ID based on machine info"""
    if os.environ.get("DEVICE_ID"):
        return os.environ.get("DEVICE_ID")
    
    # Create a persistent device ID based on machine info
    try:
        machine_hash = hashlib.md5(f"{os.uname().nodename}-{os.uname().machine}".encode()).hexdigest()
        return f"gradio-{machine_hash[:10]}"
    except:
        # Fallback for Windows
        import socket
        machine_hash = hashlib.md5(f"{socket.gethostname()}".encode()).hexdigest()
        return f"gradio-{machine_hash[:10]}"

def convert_to_jpeg(image):
    """Convert any image format to JPEG"""
    if image is None:
        return None
        
    # Convert to RGB if needed (for PNG with alpha channel)
    if image.mode != 'RGB':
        image = image.convert('RGB')
        
    # Convert to JPEG in memory
    jpeg_buffer = io.BytesIO()
    image.save(jpeg_buffer, format='JPEG', quality=95)
    jpeg_buffer.seek(0)
    
    # Return new image
    return Image.open(jpeg_buffer)

def fashn_test_api(
    model_image, 
    garment_image, 
    device_id="",
    category="auto",
    segmentation_free=True,
    mode="balanced",
    moderation_level="permissive",
    garment_photo_type="auto",
    progress=gr.Progress()
):
    """Test the FASHN.ai API via the local backend server"""
    
    # Validate inputs
    if model_image is None:
        return None, "Please upload a model image (person)"
    
    if garment_image is None:
        return None, "Please upload a garment image (clothing)"
    
    # Use provided device ID or generate one
    if not device_id:
        device_id = generate_device_id()
    
    try:
        progress(0, "Preparing images...")
        
        # Convert images to JPEG format for better compatibility
        model_image = convert_to_jpeg(model_image)
        garment_image = convert_to_jpeg(garment_image)
        
        # Convert images to bytes
        model_bytes = io.BytesIO()
        model_image.save(model_bytes, format='JPEG')
        model_bytes = model_bytes.getvalue()
        
        garment_bytes = io.BytesIO()
        garment_image.save(garment_bytes, format='JPEG')
        garment_bytes = garment_bytes.getvalue()
        
        # Create multipart form data
        files = {
            'model_image': ('model.jpg', model_bytes, 'image/jpeg'),
            'garment_image': ('garment.jpg', garment_bytes, 'image/jpeg')
        }
        
        # Include ALL the parameters expected by the backend
        data = {
            'category': category,
            'mode': mode,
            'moderation_level': moderation_level,
            'segmentation_free': str(segmentation_free).lower(),
            'garment_photo_type': garment_photo_type,
            'device_id': device_id,
            'skip_usage_tracking': 'false',  # We want to track usage
            'is_subscribed': 'false',  # Default to non-subscribed
            # Add these parameters to match the backend's expected params
            'cover_feet': 'false',  # Add the missing parameter
            'adjust_hands': 'true',
            'restore_background': 'false',
            'restore_clothes': 'false',
            'long_top': 'false'
        }
        
        # Start prediction
        progress(0.1, "Sending images to backend server...")
        
        response = requests.post(
            BACKEND_TRYON_API,
            files=files,
            data=data,
            headers={
                'X-Device-Id': device_id
            }
        )
        
        # Debug output
        print(f"Backend response status: {response.status_code}")
        print(f"Backend response: {response.text[:100]}...")
        
        response.raise_for_status()
        prediction = response.json()
        
        if "error" in prediction and prediction["error"]:
            return None, f"API Error: {prediction['error']}"
        
        prediction_id = prediction.get("id")
        if not prediction_id:
            return None, "Error: No prediction ID returned"
        
        # Poll for results
        max_polls = 40
        poll_interval = 3  # seconds
        
        for i in range(max_polls):
            # Calculate progress percentage (10%-90%)
            progress_pct = 0.1 + (i / max_polls) * 0.8
            progress(progress_pct, f"Processing: Poll {i+1}/{max_polls}")
            
            time.sleep(poll_interval)
            
            # Check status using backend endpoint
            status_response = requests.get(
                f"{BACKEND_STATUS_API}/{prediction_id}"
            )
            
            status_response.raise_for_status()
            status_data = status_response.json()
            
            status = status_data.get("status", "unknown")
            progress(progress_pct, f"Status: {status} (Poll {i+1}/{max_polls})")
            
            if status == "completed":
                # Try output field first (FASHN API v1)
                output_urls = status_data.get("output", [])
                
                # Fall back to result_url if output is not available
                if not output_urls and status_data.get("result_url"):
                    result_url = status_data["result_url"]
                    if isinstance(result_url, list):
                        output_urls = result_url
                    else:
                        output_urls = [result_url]
                
                if not output_urls:
                    return None, "Error: No output images returned"
                
                # Download result image
                progress(0.9, "Downloading result image...")
                result_url = output_urls[0]
                img_response = requests.get(result_url)
                img_response.raise_for_status()
                
                progress(1.0, "Complete!")
                result_img = Image.open(io.BytesIO(img_response.content))
                return result_img, f"Try-on successful! Device ID: {device_id}"
                
            elif status == "failed":
                error_msg = status_data.get("error", "Unknown error")
                return None, f"Prediction failed: {error_msg}"
        
        return None, "Error: Prediction timed out"
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error testing FASHN.ai API via backend: {error_details}")
        return None, f"Error: {str(e)}"

# Create Gradio interface
with gr.Blocks(title="FASHN.ai API Tester") as demo:
    gr.Markdown("# VELRA Virtual Try-On Tester (Using Backend)")
    gr.Markdown("This interface uses the local backend server to test the FASHN.ai virtual try-on.")
    
    # Display backend status
    try:
        health_check = requests.get(f"{API_BASE_URL}/health", timeout=2)
        if health_check.status_code == 200:
            backend_status = "✅ Backend server is running"
        else:
            backend_status = f"⚠️ Backend server returned status code: {health_check.status_code}"
    except Exception as e:
        backend_status = f"❌ Backend server is not available: {str(e)}"
    
    gr.Markdown(f"**Backend Status**: {backend_status}")
    
    with gr.Row():
        with gr.Column():
            gr.Markdown("## Model Image (Person)")
            model_image = gr.Image(
                label="Upload or capture a photo of a person",
                type="pil",
                sources=["upload", "webcam"],
                height=300
            )
        
        with gr.Column():
            gr.Markdown("## Garment Image (Clothing)")
            garment_image = gr.Image(
                label="Upload a photo of a clothing item",
                type="pil",
                sources=["upload"],
                height=300
            )
    
    with gr.Row():
        with gr.Column():
            device_id = gr.Textbox(
                label="Device ID (optional)",
                placeholder="Leave blank to auto-generate",
                value=""
            )
        
        with gr.Column():
            with gr.Row():
                category = gr.Dropdown(
                    label="Category",
                    choices=["auto", "tops", "bottoms", "one-pieces"],
                    value="auto"
                )
                mode = gr.Dropdown(
                    label="Mode",
                    choices=["performance", "balanced", "quality"],
                    value="balanced"
                )
            
            with gr.Row():
                moderation = gr.Dropdown(
                    label="Moderation Level",
                    choices=["conservative", "permissive", "none"],
                    value="permissive"
                )
                garment_type = gr.Dropdown(
                    label="Garment Photo Type",
                    choices=["auto", "flat-lay", "model"],
                    value="auto"
                )
            
            segmentation_free = gr.Checkbox(
                label="Segmentation Free",
                value=True
            )
    
    test_button = gr.Button("Try It On!", variant="primary", size="lg")
    
    with gr.Row():
        with gr.Column():
            result_image = gr.Image(label="Try-On Result")
        with gr.Column():
            status = gr.Textbox(label="Status", interactive=False)
    
    # Connect components
    test_button.click(
        fn=fashn_test_api,
        inputs=[
            model_image,
            garment_image,
            device_id,
            category,
            segmentation_free,
            mode,
            moderation,
            garment_type
        ],
        outputs=[result_image, status]
    )

# Run the app
if __name__ == "__main__":
    demo.launch(share=True) 