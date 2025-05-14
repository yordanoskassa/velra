import gradio as gr
import requests
import base64
import uuid
import os
from PIL import Image
import io
import json
import time
import hashlib
from typing import List, Dict, Any, Tuple, Optional

# Configuration
API_BASE_URL = "http://localhost:8000"  # Update with your API URL
FASHN_API_URL = "https://api.fashn.ai/v1"  # FASHN.ai API URL

# Store product data globally for try-on access (using gr.State is better)
# product_data_store = [] 

def get_products_by_category_from_api(category_id: str = "", per_page: int = 24, page: int = 1) -> Dict[str, Any]:
    """
    Fetch products by category using the backend API integration.
    """
    try:
        params = {
            "categoryId": category_id,
            "perPage": per_page,
            "page": page,
            # Currency and CountryISO can be added if needed in UI
        }
        
        # Call the backend endpoint
        response = requests.get(f"{API_BASE_URL}/products/by_category", params=params) 
        
        response.raise_for_status()
        
        # Backend now returns a list directly (processed from ASOS { message, data, error })
        product_list = response.json() 
        return {"products": product_list, "itemCount": len(product_list)} 
    
    except requests.exceptions.HTTPError as http_err:
        error_detail = "Unknown error"
        try:
            error_json = http_err.response.json()
            error_detail = error_json.get("detail", str(http_err))
        except json.JSONDecodeError:
            error_detail = str(http_err)
        print(f"HTTP error fetching category products: {error_detail}")
        return {"products": [], "itemCount": 0, "error": error_detail}
        
    except requests.exceptions.RequestException as req_err:
        print(f"Request error fetching category products: {str(req_err)}")
        return {"products": [], "itemCount": 0, "error": f"Connection error: {str(req_err)}"}
        
    except Exception as e:
        print(f"Unexpected error fetching category products: {str(e)}")
        return {"products": [], "itemCount": 0, "error": f"An unexpected error occurred: {str(e)}"}

def generate_device_id():
    """Generate a random device ID for testing purposes"""
    return str(uuid.uuid4())

def virtual_tryon(person_image, garment_id, device_id=""):
    """
    Perform virtual try-on using the API
    """
    try:
        # Ensure we have a device_id
        if not device_id:
            device_id = generate_device_id()
            
        # Convert Gradio image to bytes
        if person_image is None:
            return None, "Please upload a person image"
            
        # Prepare the image for the API request
        img_byte_arr = io.BytesIO()
        person_image.save(img_byte_arr, format='JPEG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Create the multipart form data
        files = {
            'file': ('person.jpg', img_byte_arr, 'image/jpeg')
        }
        
        # Add the device ID to the request
        data = {
            'device_id': device_id
        }
        
        # Add the garment ID if it's provided
        if garment_id:
            # IMPORTANT: Ensure garment_id format from new API is compatible
            data['garment_id'] = str(garment_id) 
            
        # Make the API request
        response = requests.post(f"{API_BASE_URL}/tryon", files=files, data=data)
        response.raise_for_status()
        result = response.json()
        
        # Process the response
        if 'image' in result:
            img_data = base64.b64decode(result['image'])
            result_img = Image.open(io.BytesIO(img_data))
            return result_img, f"Try-on successful! Device ID: {device_id}"
        
        return None, f"Error: Try-on failed - {result.get('message', 'Unknown error')}"
        
    except Exception as e:
        print(f"Error during virtual try-on: {str(e)}")
        return None, f"Error: {str(e)}"

def format_category_product_results(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Format the category product results from the backend API response"""
    formatted_results = []
    
    # Check if results contain an error message
    if "error" in results and results["error"]:
        print(f"Error received from backend: {results['error']}")
        return []
    
    # Add debugging
    print(f"Processing results with {len(results.get('products', []))} products")
    
    for product in results.get("products", []): 
        try:
            # Skip invalid products
            if not product:
                continue
                
            # Debug the product structure if needed
            # print(f"Product keys: {product.keys() if isinstance(product, dict) else 'not a dict'}")
            
            image_url = product.get("imageUrl")
            
            # Handle different price structure possibilities
            price_text = "$?"
            price_obj = product.get("price", {})
            
            if isinstance(price_obj, dict):
                # Try different paths to price text
                if "current" in price_obj and isinstance(price_obj["current"], dict):
                    price_text = price_obj["current"].get("text", "$?")
                elif "text" in price_obj:
                    price_text = price_obj["text"]
                elif "currentPrice" in price_obj:
                    price_text = price_obj["currentPrice"]
            
            formatted_product = {
                "image": image_url,
                "name": product.get("name", "Unknown Product"),
                "id": product.get("id"), # Keep the actual product ID
                "price": price_text,
                "brand": product.get("brandName", "Unknown Brand"),
            }
            
            if formatted_product["id"] is not None and formatted_product["image"]:
                formatted_results.append(formatted_product)
        except Exception as e:
            print(f"Error formatting product: {e}")
            # Continue with next product instead of failing
        
    return formatted_results

def search_category_and_display(category_id: str, per_page: int) -> Tuple[List[Tuple[str, str]], str, List[Dict[str, Any]]]:
    """Fetch products by category and format for display."""
    if not category_id:
        return [], "Please enter a Category ID.", []
        
    # Using page=1 for simplicity, add page input later if needed
    results = get_products_by_category_from_api(category_id, per_page, page=1) 
    
    if "error" in results:
        return [], f"Error: {results['error']}", []
        
    formatted_results = format_category_product_results(results)
    
    gallery_items = []
    for product in formatted_results:
        image_url = product["image"]
        caption = f"{product['name']} - {product['price']}"
        if image_url:
            gallery_items.append((image_url, caption))
        else:
            gallery_items.append((None, caption))
            
    status_message = f"Found {results.get('itemCount', len(gallery_items))} products for Category ID {category_id}"
    
    return gallery_items, status_message, formatted_results

def tryon_selected_product(person_image: Image.Image, selected_index: int, product_results_state: List[Dict[str, Any]], device_id: str):
    """Try on the selected product from the gallery using stored product ID."""
    if selected_index is None or selected_index < 0:
         return None, "Please search and select a product first."
         
    if not product_results_state or selected_index >= len(product_results_state):
        return None, "Selected index out of range or no product data available. Please search again."
        
    # Get the selected product's data from the state
    selected_product = product_results_state[selected_index]
    product_id = selected_product.get("id")
    
    if not product_id:
        return None, f"Error: Could not find ID for selected product: {selected_product.get('name')}"
    
    print(f"Attempting try-on for product ID: {product_id}") # Debugging
    
    # Perform the virtual try-on
    return virtual_tryon(person_image, product_id, device_id)

def search_products_from_api(query: str = "", per_page: int = 24, page: int = 1) -> Dict[str, Any]:
    """
    Search for products using the /products/search endpoint
    """
    try:
        params = {
            "query": query,
            "perPage": per_page,
            "page": page,
        }
        
        # Call the backend endpoint
        response = requests.get(f"{API_BASE_URL}/products/search", params=params) 
        
        response.raise_for_status()
        
        # Backend returns a list directly
        product_list = response.json() 
        return {"products": product_list, "itemCount": len(product_list)} 
    
    except requests.exceptions.HTTPError as http_err:
        error_detail = "Unknown error"
        try:
            error_json = http_err.response.json()
            error_detail = error_json.get("detail", str(http_err))
        except json.JSONDecodeError:
            error_detail = str(http_err)
        print(f"HTTP error searching products: {error_detail}")
        return {"products": [], "itemCount": 0, "error": error_detail}
        
    except requests.exceptions.RequestException as req_err:
        print(f"Request error searching products: {str(req_err)}")
        return {"products": [], "itemCount": 0, "error": f"Connection error: {str(req_err)}"}
        
    except Exception as e:
        print(f"Unexpected error searching products: {str(e)}")
        return {"products": [], "itemCount": 0, "error": f"An unexpected error occurred: {str(e)}"}

# New function for direct FASHN.ai API testing
def fashn_direct_test(
    model_image: Image.Image, 
    garment_image: Image.Image, 
    api_key: str,
    device_id: str = "",
    category: str = "auto",
    segmentation_free: bool = True,
    mode: str = "balanced",
    moderation_level: str = "permissive",
    garment_photo_type: str = "auto"
) -> Tuple[Optional[Image.Image], str]:
    """
    Test the FASHN.ai API directly with image inputs
    
    Args:
        model_image: The person image to try clothes on
        garment_image: The garment image
        api_key: FASHN.ai API key
        device_id: Device ID for tracking usage
        category: Category of clothing (auto, tops, bottoms, one-pieces)
        segmentation_free: Whether to use segmentation-free mode
        mode: Quality mode (performance, balanced, quality)
        moderation_level: Content filtering level
        garment_photo_type: Type of garment photo
        
    Returns:
        Tuple of (result image, status message)
    """
    if not model_image or not garment_image:
        return None, "Please upload both model and garment images"
    
    if not api_key:
        return None, "Please enter your FASHN.ai API key"
    
    # Generate device ID if not provided
    if not device_id:
        if os.environ.get("DEVICE_ID"):
            device_id = os.environ.get("DEVICE_ID")
        else:
            # Create a persistent device ID based on machine info
            machine_hash = hashlib.md5(f"{os.uname().nodename}-{os.uname().machine}".encode()).hexdigest()
            device_id = f"gradio-{machine_hash[:10]}"
    
    try:
        # Convert images to base64 for API
        def img_to_base64(img):
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return f"data:image/jpeg;base64,{img_str}"
        
        model_b64 = img_to_base64(model_image)
        garment_b64 = img_to_base64(garment_image)
        
        # Prepare the request to the FASHN.ai API
        data = {
            "model_image": model_b64,
            "garment_image": garment_b64,
            "category": category,
            "segmentation_free": segmentation_free,
            "mode": mode,
            "moderation_level": moderation_level,
            "garment_photo_type": garment_photo_type,
            # Include device ID in a custom header for tracking
            "device_id": device_id
        }
        
        # Make the API request
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-Device-ID": device_id  # Custom header for device tracking
        }
        
        # Start the prediction
        response = requests.post(
            f"{FASHN_API_URL}/run",
            headers=headers,
            json=data
        )
        
        response.raise_for_status()
        prediction = response.json()
        
        if "error" in prediction and prediction["error"]:
            return None, f"API Error: {prediction['error']}"
        
        prediction_id = prediction.get("id")
        if not prediction_id:
            return None, "Error: No prediction ID returned"
            
        # Poll for results
        status_message = "Starting prediction..."
        max_polls = 40
        poll_interval = 3  # seconds
        
        for i in range(max_polls):
            time.sleep(poll_interval)
            
            # Check status
            status_response = requests.get(
                f"{FASHN_API_URL}/status/{prediction_id}",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            
            status_response.raise_for_status()
            status_data = status_response.json()
            
            status = status_data.get("status", "unknown")
            status_message = f"Status: {status} (Poll {i+1}/{max_polls})"
            
            if status == "completed":
                output_urls = status_data.get("output", [])
                if not output_urls:
                    return None, "Error: No output images returned"
                
                # Download the result image
                result_url = output_urls[0]
                img_response = requests.get(result_url)
                img_response.raise_for_status()
                
                result_img = Image.open(io.BytesIO(img_response.content))
                return result_img, f"Try-on successful! Device ID: {device_id}"
                
            elif status == "failed":
                error_msg = status_data.get("error", "Unknown error")
                return None, f"Prediction failed: {error_msg}"
        
        return None, "Error: Prediction timed out"
    
    except Exception as e:
        print(f"Error testing FASHN.ai API: {str(e)}")
        return None, f"Error: {str(e)}"

def search_by_term_and_display(query: str, per_page: int) -> Tuple[List[Tuple[str, str]], str, List[Dict[str, Any]]]:
    """Search for products by term and format for display."""
    if not query:
        return [], "Please enter a search term.", []
    
    results = search_products_from_api(query, per_page, page=1) 
    
    if "error" in results:
        return [], f"Error: {results['error']}", []
    
    formatted_results = format_category_product_results(results)
    
    gallery_items = []
    for product in formatted_results:
        image_url = product["image"]
        caption = f"{product['name']} - {product['price']}"
        if image_url:
            gallery_items.append((image_url, caption))
        else:
            gallery_items.append((None, caption))
        
    status_message = f"Found {results.get('itemCount', len(gallery_items))} products for '{query}'"
    
    return gallery_items, status_message, formatted_results

# Add this new function before creating the Gradio interface
def validate_images(model_image, garment_image):
    """Validate that both images are provided and return a preview message"""
    if model_image is None and garment_image is None:
        return "❌ Both images are missing. Please upload a model image (person) and a garment image (clothing)."
    elif model_image is None:
        return "❌ Model image (person) is missing. Please upload or capture one."
    elif garment_image is None:
        return "❌ Garment image (clothing) is missing. Please upload one."
    else:
        return "✅ Both images uploaded successfully! Click 'Test FASHN.ai API' to start."

# Create the Gradio interface
with gr.Blocks(title="VELRA Virtual Try-On") as demo:
    gr.Markdown("# VELRA Virtual Try-On and Product Search by Category")
    
    # State to store the full product results from the search
    product_results_state = gr.State([]) 
    # State to store the index of the selected gallery item
    selected_product_index_state = gr.State(None) 
    
    with gr.Tab("Product Search by Category"):
        with gr.Row():
            with gr.Column(scale=1):
                # Changed from query input to category ID input
                category_id_input = gr.Textbox(label="Category ID (e.g., 27108)") 
                
                # Changed from limit slider to perPage number input
                per_page_input = gr.Number( 
                    minimum=1, 
                    maximum=100, 
                    step=1, 
                    value=24, 
                    label="Products per Page"
                )
                # Add Page input later if needed
                # page_input = gr.Number(minimum=1, step=1, value=1, label="Page Number")
                
                search_btn = gr.Button("Search by Category")
            
            with gr.Column(scale=3):
                product_gallery = gr.Gallery(
                    label="Products", 
                    columns=6, 
                    object_fit="contain",
                    preview=True
                )
                search_status = gr.Textbox(label="Status", interactive=False)
    
    with gr.Tab("Virtual Try-On"):
        with gr.Row():
            with gr.Column():
                person_image_input = gr.Image(
                    label="Upload Person Image", 
                    type="pil"
                )
                device_id_input = gr.Textbox(
                    label="Device ID (optional, leave blank to auto-generate)", 
                    placeholder="Auto-generated if empty"
                )
                tryon_btn = gr.Button("Try On Selected Product")
            
            with gr.Column():
                tryon_result = gr.Image(label="Try-On Result")
                tryon_status = gr.Textbox(label="Status", interactive=False)
                # Add a textbox to show which item is selected (optional)
                selected_item_display = gr.Textbox(label="Selected Item Index", interactive=False)
    
    with gr.Tab("Product Search by Term"):
        with gr.Row():
            with gr.Column(scale=1):
                # Search by term
                search_term_input = gr.Textbox(label="Search Term (e.g., 'dress', 'jeans')")
                
                per_page_search_input = gr.Number( 
                    minimum=1, 
                    maximum=100, 
                    step=1, 
                    value=24, 
                    label="Products per Page"
                )
                
                search_term_btn = gr.Button("Search Products")
            
            with gr.Column(scale=3):
                search_term_gallery = gr.Gallery(
                    label="Products", 
                    columns=6, 
                    object_fit="contain",
                    preview=True
                )
                search_term_status = gr.Textbox(label="Status", interactive=False)
    
    # New tab for direct FASHN.ai API testing
    with gr.Tab("FASHN.ai API Direct Test"):
        gr.Markdown("## Upload Images")
        gr.Markdown("You need to upload **both** a model image (person) and a garment image (clothing item).")
        
        # Image validation message
        image_validation_msg = gr.Textbox(
            label="Image Validation", 
            value="❌ Please upload both images to continue.",
            interactive=False
        )
        
        with gr.Row():
            with gr.Column():
                gr.Markdown("### Person/Model Image")
                model_image_input = gr.Image(
                    label="Upload or Capture Model Image (Person)", 
                    type="pil",
                    sources=["upload", "webcam"],
                    height=300
                )
            
            with gr.Column():
                gr.Markdown("### Garment Image")
                garment_image_input = gr.Image(
                    label="Upload Garment Image (Clothing)", 
                    type="pil",
                    sources=["upload"],
                    height=300
                )
        
        with gr.Row():
            with gr.Column():
                api_key_input = gr.Textbox(
                    label="FASHN.ai API Key", 
                    type="password"
                )
                device_id_input_fashn = gr.Textbox(
                    label="Device ID (optional, leave blank to auto-generate)", 
                    placeholder="Auto-generated if empty"
                )
            
            with gr.Column():
                with gr.Row():
                    category_input = gr.Dropdown(
                        label="Category",
                        choices=["auto", "tops", "bottoms", "one-pieces"],
                        value="auto"
                    )
                    mode_input = gr.Dropdown(
                        label="Mode",
                        choices=["performance", "balanced", "quality"],
                        value="balanced"
                    )
                with gr.Row():
                    moderation_input = gr.Dropdown(
                        label="Moderation Level",
                        choices=["conservative", "permissive", "none"],
                        value="permissive"
                    )
                    garment_type_input = gr.Dropdown(
                        label="Garment Photo Type",
                        choices=["auto", "flat-lay", "model"],
                        value="auto"
                    )
                
                segmentation_free_input = gr.Checkbox(
                    label="Segmentation Free", 
                    value=True
                )
        
        fashn_test_btn = gr.Button("Test FASHN.ai API", variant="primary", size="lg")
        
        with gr.Row():
            with gr.Column():
                fashn_result = gr.Image(label="Try-On Result")
                fashn_status = gr.Textbox(label="Status", interactive=False)
    
    # Connect the components - moved outside of tabs
    # NEW: Handle gallery selection: store the index in state
    def store_selected_index(evt: gr.SelectData):
        print(f"Gallery item selected: Index {evt.index}") # Debugging
        return evt.index

    product_gallery.select(
        fn=store_selected_index,
        inputs=None, # No direct inputs, event data is passed implicitly
        outputs=[selected_product_index_state, selected_item_display] # Update state and display
    )

    # Search category button
    search_btn.click(
        fn=search_category_and_display, 
        inputs=[category_id_input, per_page_input], 
        outputs=[product_gallery, search_status, product_results_state]
    )

    # Try-on button
    tryon_btn.click(
        fn=tryon_selected_product,
        inputs=[person_image_input, selected_product_index_state, product_results_state, device_id_input], 
        outputs=[tryon_result, tryon_status]
    )

    # Search term button
    search_term_btn.click(
        fn=search_by_term_and_display,
        inputs=[search_term_input, per_page_search_input],
        outputs=[search_term_gallery, search_term_status, product_results_state]
    )

    # Search term gallery selection
    search_term_gallery.select(
        fn=store_selected_index,
        inputs=None,
        outputs=[selected_product_index_state, selected_item_display]
    )

    # FASHN.ai API test button
    fashn_test_btn.click(
        fn=fashn_direct_test,
        inputs=[
            model_image_input, 
            garment_image_input, 
            api_key_input,
            device_id_input_fashn,
            category_input,
            segmentation_free_input,
            mode_input,
            moderation_input,
            garment_type_input
        ],
        outputs=[fashn_result, fashn_status]
    )

    # Connect image validation
    model_image_input.change(
        fn=validate_images,
        inputs=[model_image_input, garment_image_input],
        outputs=image_validation_msg
    )
    
    garment_image_input.change(
        fn=validate_images,
        inputs=[model_image_input, garment_image_input],
        outputs=image_validation_msg
    )

# Launch the app
if __name__ == "__main__":
    demo.launch(share=True) 