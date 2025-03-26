from fastapi import APIRouter, HTTPException, status
import httpx
import os
from typing import List, Dict, Any
import asyncio
from pydantic import BaseModel
from datetime import datetime
from config import settings

# Create router
stocks_router = APIRouter()

# Define models
class StockPrice(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_percent: float
    updated_at: datetime = datetime.now()

# List of major stocks to track
MAJOR_STOCKS = [
    {"symbol": "AAPL", "name": "Apple"},
    {"symbol": "MSFT", "name": "Microsoft"},
    {"symbol": "GOOGL", "name": "Alphabet"},
    {"symbol": "AMZN", "name": "Amazon"},
    {"symbol": "META", "name": "Meta"},
    {"symbol": "TSLA", "name": "Tesla"},
    {"symbol": "NVDA", "name": "NVIDIA"},
    {"symbol": "JPM", "name": "JPMorgan"},
    {"symbol": "V", "name": "Visa"},
    {"symbol": "DIS", "name": "Disney"}
]

# Cache for stock data to avoid excessive API calls
stock_cache = {}
last_fetch_time = datetime.now()
CACHE_DURATION_SECONDS = 60  # Cache for 1 minute

async def fetch_stock_data(symbol: str) -> Dict[str, Any]:
    """Fetch stock data from Alpha Vantage API"""
    # Using Alpha Vantage API (free tier)
    api_key = settings.ALPHAVANTAGE_API_KEY or "demo"
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to fetch stock data for {symbol}"
            )
        
        data = response.json()
        if "Global Quote" not in data or not data["Global Quote"]:
            # Fallback to mock data if API limit is reached or symbol not found
            return {
                "symbol": symbol,
                "price": 100 + (hash(symbol) % 900),  # Deterministic mock price
                "change": (hash(symbol) % 10) - 5,     # Deterministic mock change
                "change_percent": ((hash(symbol) % 10) - 5) / 100  # Deterministic mock percent
            }
        
        quote = data["Global Quote"]
        return {
            "symbol": symbol,
            "price": float(quote.get("05. price", 0)),
            "change": float(quote.get("09. change", 0)),
            "change_percent": float(quote.get("10. change percent", "0").replace("%", ""))
        }

@stocks_router.get("/prices", response_model=List[StockPrice])
async def get_stock_prices():
    """Get prices for major stocks"""
    global stock_cache, last_fetch_time
    
    current_time = datetime.now()
    time_diff = (current_time - last_fetch_time).total_seconds()
    
    # Check if cache is valid
    if stock_cache and time_diff < CACHE_DURATION_SECONDS:
        return list(stock_cache.values())
    
    # Fetch new data
    tasks = []
    for stock in MAJOR_STOCKS:
        tasks.append(fetch_stock_data(stock["symbol"]))
    
    try:
        results = await asyncio.gather(*tasks)
        
        # Update cache
        stock_cache = {}
        for i, result in enumerate(results):
            stock_data = StockPrice(
                symbol=result["symbol"],
                name=MAJOR_STOCKS[i]["name"],
                price=result["price"],
                change=result["change"],
                change_percent=result["change_percent"],
                updated_at=current_time
            )
            stock_cache[result["symbol"]] = stock_data
        
        last_fetch_time = current_time
        return list(stock_cache.values())
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stock prices: {str(e)}"
        )

@stocks_router.get("/price/{symbol}", response_model=StockPrice)
async def get_stock_price(symbol: str):
    """Get price for a specific stock"""
    symbol = symbol.upper()
    
    # Check cache first
    if symbol in stock_cache:
        current_time = datetime.now()
        time_diff = (current_time - last_fetch_time).total_seconds()
        if time_diff < CACHE_DURATION_SECONDS:
            return stock_cache[symbol]
    
    # Find stock name
    stock_name = next((stock["name"] for stock in MAJOR_STOCKS if stock["symbol"] == symbol), symbol)
    
    try:
        result = await fetch_stock_data(symbol)
        stock_data = StockPrice(
            symbol=symbol,
            name=stock_name,
            price=result["price"],
            change=result["change"],
            change_percent=result["change_percent"],
            updated_at=datetime.now()
        )
        
        # Update cache
        stock_cache[symbol] = stock_data
        return stock_data
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stock price for {symbol}: {str(e)}"
        ) 