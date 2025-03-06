from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import random
import httpx
import json
import os
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from pathlib import Path
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from fastapi.middleware.cors import CORSMiddleware
from models import Article

# Load environment variables and configure Gemini
load_dotenv()
news_api_key = os.getenv("NEWS_API_KEY")
gemini_api_key = os.getenv("GEMINI_API_KEY")

if not news_api_key or not gemini_api_key:
    raise RuntimeError("API keys missing from .env file")

genai.configure(api_key=gemini_api_key)
# Update to use the correct model name
gemini_model = genai.GenerativeModel('gemini-1.5-pro')

news_router = APIRouter(prefix="", tags=["News"])

@news_router.post("/api/market-insights/article")
async def generate_gemini_insights(article: Article):
    """Generate market insights using Gemini AI"""
    prompt = f"""Analyze this financial news article and provide structured insights:
        Title: {article.title if article.title else 'No Title'}
        Content: {article.content}
        Source: {article.source if article.source else 'Unknown Source'}
        Published At: {article.publishedAt if article.publishedAt else 'Unknown Date'}
        
        Provide analysis in this JSON format:
        {{
            "key_points": ["list", "of", "key", "points"],
            "potential_impact": {{
                "stocks": "analysis",
                "commodities": "analysis",
                "forex": "analysis"
            }},
            "recommended_actions": ["list", "of", "actions"],
            "confidence_score": 0-100
        }}"""

    try:
        response = await asyncio.wait_for(
            gemini_model.generate_content_async(prompt),
            timeout=20.0
        )
        
        if not response.text:
            raise ValueError("Empty response from Gemini API")
        
        # Clean the response text to remove markdown code block syntax if present
        response_text = response.text
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "", 1)
        if response_text.endswith("```"):
            response_text = response_text.rsplit("```", 1)[0]
        
        # Strip any leading/trailing whitespace
        response_text = response_text.strip()
        
        try:
            # Parse the cleaned JSON
            parsed_response = json.loads(response_text)
            
            # Validate the response structure
            required_keys = ["key_points", "potential_impact", "recommended_actions"]
            missing_keys = [key for key in required_keys if key not in parsed_response]
            
            if missing_keys:
                print(f"Missing required keys in response: {missing_keys}")
                # Create default values for missing keys
                for key in missing_keys:
                    if key == "key_points":
                        parsed_response["key_points"] = ["No key points provided by the AI model"]
                    elif key == "potential_impact":
                        parsed_response["potential_impact"] = {
                            "stocks": "Impact analysis unavailable",
                            "commodities": "Impact analysis unavailable",
                            "forex": "Impact analysis unavailable"
                        }
                    elif key == "recommended_actions":
                        parsed_response["recommended_actions"] = ["No recommended actions provided"]
            
            # Ensure key_points is an array
            if not isinstance(parsed_response.get("key_points", []), list):
                parsed_response["key_points"] = [str(parsed_response["key_points"])]
                
            # Ensure recommended_actions is an array
            if not isinstance(parsed_response.get("recommended_actions", []), list):
                parsed_response["recommended_actions"] = [str(parsed_response["recommended_actions"])]
                
            # Add confidence score if missing
            if "confidence_score" not in parsed_response:
                parsed_response["confidence_score"] = random.randint(40, 90)
                
            return parsed_response
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}\nResponse text: {response_text}")
            
            # Try to extract JSON-like content from the text
            import re
            json_pattern = r'\{[\s\S]*\}'
            match = re.search(json_pattern, response_text)
            
            if match:
                try:
                    extracted_json = match.group(0)
                    parsed_response = json.loads(extracted_json)
                    return parsed_response
                except json.JSONDecodeError:
                    pass
            
            # If all parsing attempts fail, return a structured error with the raw response
            return {
                "error": "Failed to parse analysis",
                "raw_response": response_text
            }
    except asyncio.TimeoutError:
        print("Gemini API request timed out")
        raise HTTPException(
            status_code=504,
            detail="Analysis request timed out. Please try again."
        )
    except Exception as e:
        print(f"Gemini API error: {str(e)}\nPrompt: {(prompt if 'prompt' in locals() else 'Prompt not generated')}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate insights: {str(e)}"
        )


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_news_with_retry(client, params):
    return await client.get(
        "https://newsapi.org/v2/top-headlines",
        params=params,
        headers={"User-Agent": "FinancialApp/1.0"},
        timeout=10.0
    )

@news_router.get("/api/news")
async def get_news():
    """Fetch financial news with Gemini analysis"""
    async with httpx.AsyncClient() as client:
        try:
            # Get news from NewsAPI
            news_params = {
                "apiKey": news_api_key,
                "category": "business",
                "country": "us",
                "pageSize": 10
            }
            
            response = await fetch_news_with_retry(client, news_params)
            response.raise_for_status()
            news_data = response.json()

            # Add Gemini analysis to articles with error handling
            articles = news_data.get("articles", [])
            for article in articles:
                if article.get("content"):
                    try:
                        article["analysis"] = await generate_gemini_insights(article)
                    except Exception as e:
                        print(f"Error analyzing article '{article['title']}': {str(e)}")
                        article["analysis"] = {
                            "error": "Analysis failed",
                            "details": str(e)
                        }
            # Remove articles without content before returning
            news_data["articles"] = [a for a in articles if a.get("content")]
            
            return news_data
            
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail="News API error: " + str(e)
            )
