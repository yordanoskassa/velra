# ASOS API Integration & Virtual Try-On Testing

This document provides instructions for using the ASOS API integration and Gradio interface for testing product loading and virtual try-on functionality.

## Overview

The implementation includes:

1. **ASOS API Integration**: Fetches products with filtering by gender, product type, and search terms
2. **Virtual Try-On API Access**: Utilizes the existing virtual try-on functionality
3. **Gradio Interface**: A simple web UI for testing both features together

## Setup

### 1. Environment Variables

Configure your `.env` file with the required API keys:

```dotenv
ASOS_API_KEY=<your_rapidapi_key>
ASOS_API_HOST=asos-api6.p.rapidapi.com # Updated Host
```

To get an ASOS API key:
1. Sign up at [RapidAPI](https://rapidapi.com)
2. Subscribe to an ASOS API service
3. Copy your API key from the dashboard

### 2. Install Dependencies

Make sure you have all required packages:

```bash
pip install -r requirements.txt
```

## Running the Application

### 1. Start the FastAPI Backend

```bash
cd backend
uvicorn main:app --reload
```

This will start the API server on `http://localhost:8000`.

### 2. Launch the Gradio Interface

```bash
cd backend
python gradio_interface.py
```

This will start the Gradio interface, typically on `http://localhost:7860`.

## Using the Interface

The Gradio interface has two tabs:

### Product Search Tab

- Enter search terms, select gender and product type filters
- Adjust the number of results to display
- Click "Search Products" to fetch and display products
- Select a product to use with the virtual try-on

### Virtual Try-On Tab

- Upload a person image
- A device ID is automatically generated (you can customize it)
- Click "Try On Selected Product" to see the virtual try-on result

## API Endpoints

### Product Search

```
GET /api/v1/getProductListBySearchTerm
```

Query Parameters:
- `searchTerm`: Search term (e.g., "dress", "mens jeans")
- `currency`: (e.g., "USD")
- `country`: (e.g., "US")
- `store`: (e.g., "US")
- `languageShort`: (e.g., "en")
- `limit`: Number of results (e.g., 50)
- `offset`: Starting offset for pagination (e.g., 0)
- `sort`: Sorting method (e.g., "recommended")

Example:
```
http://localhost:8000/products/search?query=dress&limit=20
```

### Product Search by Category

*   **Endpoint:** `GET /product/bycategory`
*   **Description:** Fetches a list of products based on a category ID.
*   **Required Query Parameters:**
    *   `categoryId` (string): The ID of the category (e.g., "27108").
*   **Optional Query Parameters:**
    *   `page` (string, default: "1"): Page number for pagination.
    *   `perPage` (string, default: "24"): Number of products per page.
    *   `currency` (string, default: "USD"): Currency code.
    *   `countryISO` (string, default: "US"): Country ISO code.
*   **Headers:**
    *   `X-RapidAPI-Key`: Your API key.
    *   `X-RapidAPI-Host`: `asos-api6.p.rapidapi.com`
*   **Example URL:** `https://asos-api6.p.rapidapi.com/product/bycategory?categoryId=27108&currency=USD&countryISO=US&page=1&perPage=12`

### Virtual Try-On

```
POST /tryon
```

Form Data:
- `file`: Person image file
- `device_id`: Unique device identifier
- `garment_id`: ID of the garment to try on

## Notes

- If no ASOS API key is provided, the system will use mock data for testing
- The virtual try-on uses the existing API endpoint from the VELRA backend
- No login is required for testing, as device ID is used for usage counting 