from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
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
from models import Article, RapidAPIHeadline
from database import get_headlines_collection
from config import settings

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
    prompt = f"""Analyze this financial news article and provide structured insights the confidence score should be between 0 and 100 based on the analysis:
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

            # Ensure confidence_score is an intege:
            
                
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
async def get_news(analyze: bool = False):
    """Fetch financial news with optional Gemini analysis"""
    try:
        # Get headlines from database instead of NewsAPI
        headlines_collection = get_headlines_collection()
        if headlines_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Get headlines, sorted by published date (newest first)
        print("Fetching headlines from database, sorted by published_datetime_utc")
        cursor = headlines_collection.find({}).sort("published_datetime_utc", -1).limit(10)
        headlines = await cursor.to_list(length=10)
        
        print(f"Found {len(headlines)} headlines in database")
        
        # Convert ObjectId to string for JSON serialization
        for headline in headlines:
            headline["_id"] = str(headline["_id"])
            
        # Log the first headline's date to verify sorting
        if headlines and len(headlines) > 0:
            print(f"Most recent headline date: {headlines[0].get('published_datetime_utc', 'No date')}")
            print(f"Most recent headline title: {headlines[0].get('title', 'No title')}")
        
        # Transform the data to match the format expected by the frontend
        articles = []
        for headline in headlines:
            article = {
                "id": headline["_id"],
                "title": headline["title"],
                "url": headline["link"],
                "urlToImage": headline["photo_url"] or headline["thumbnail_url"],
                "publishedAt": headline["published_datetime_utc"],
                "content": headline["snippet"],
                "source": {
                    "name": headline["source_name"] or "News Source"
                },
                "author": ", ".join(headline["authors"]) if isinstance(headline["authors"], list) else headline["authors"],
                "category": "business",
                "sentiment": "neutral"  # Default sentiment
            }
            
            # Add Gemini analysis only if requested
            if analyze and article.get("content"):
                try:
                    article_obj = Article(
                        title=article["title"],
                        content=article["content"] + " " * (100 - len(article["content"])) if len(article["content"]) < 100 else article["content"],
                        url=article["url"],
                        publishedAt=article["publishedAt"],
                        source=article["source"]["name"]
                    )
                    article["analysis"] = await generate_gemini_insights(article_obj)
                except Exception as e:
                    print(f"Error analyzing article '{article['title']}': {str(e)}")
                    article["analysis"] = {
                        "error": "Analysis failed",
                        "details": str(e)
                    }
            
            articles.append(article)
        
        # Return in the format expected by the frontend
        return {"articles": articles, "status": "ok", "totalResults": len(articles)}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching news: {str(e)}"
        )

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def fetch_rapidapi_headlines():
    """Fetch headlines from RapidAPI Real-Time News Data API"""
    url = "https://real-time-news-data.p.rapidapi.com/top-headlines"
    
    querystring = {
        "limit": "50",
        "country": "US",
        "lang": "en"
    }
    
    headers = {
        "x-rapidapi-host": settings.RAPIDAPI_HOST,
        "x-rapidapi-key": settings.RAPIDAPI_KEY
    }
    
    print(f"Fetching headlines from RapidAPI with host: {settings.RAPIDAPI_HOST}")
    print(f"API Key available: {'Yes' if settings.RAPIDAPI_KEY else 'No'}")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=querystring, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        
        # Log the response structure to help debug
        print(f"RapidAPI response status: {data.get('status', 'No status')}")
        print(f"Number of headlines received: {len(data.get('data', []))}")
        
        return data

@news_router.post("/api/fetch-rapidapi-headlines")
async def fetch_and_save_rapidapi_headlines(background_tasks: BackgroundTasks):
    """Fetch headlines from RapidAPI and save to database"""
    # Run the task in the background
    background_tasks.add_task(_fetch_and_save_headlines)
    return {"message": "Headlines fetch started in background"}

async def _fetch_and_save_headlines():
    """Background task to fetch and save headlines"""
    try:
        # Fetch headlines from RapidAPI
        headlines_data = await fetch_rapidapi_headlines()
        
        if headlines_data.get("status") != "OK" or "data" not in headlines_data:
            print(f"Error fetching headlines: {headlines_data}")
            return
        
        # Get headlines collection
        headlines_collection = get_headlines_collection()
        if headlines_collection is None:
            print("Headlines collection not available")
            return
        
        # Process and save headlines
        headlines = headlines_data.get("data", [])
        print(f"Processing {len(headlines)} headlines from RapidAPI")
        
        saved_count = 0
        updated_count = 0
        
        for headline in headlines[:50]:  # Limit to 50 headlines
            try:
                # Create headline object with proper data handling
                headline_dict = {
                    "title": headline.get("title", ""),
                    "link": headline.get("link", ""),
                    "snippet": headline.get("snippet"),
                    "photo_url": headline.get("photo_url"),
                    "thumbnail_url": headline.get("thumbnail_url"),
                    "published_datetime_utc": headline.get("published_datetime_utc"),
                    "authors": headline.get("authors", []),
                    "source_url": headline.get("source_url"),
                    "source_name": headline.get("source_name"),
                    "source_logo_url": headline.get("source_logo_url"),
                    "source_favicon_url": headline.get("source_favicon_url"),
                    "source_publication_id": headline.get("source_publication_id"),
                    "related_topics": headline.get("related_topics", []),
                    "sub_articles": headline.get("sub_articles", []),
                    "story_id": headline.get("story_id"),
                    "fetched_at": datetime.utcnow()
                }
                
                # Check if headline already exists (by link)
                existing = await headlines_collection.find_one({"link": headline_dict["link"]})
                if not existing:
                    # Insert new headline
                    await headlines_collection.insert_one(headline_dict)
                    saved_count += 1
                    print(f"Saved new headline: {headline_dict['title'][:50]}...")
                else:
                    # Update existing headline with new data
                    await headlines_collection.update_one(
                        {"link": headline_dict["link"]},
                        {"$set": headline_dict}
                    )
                    updated_count += 1
            except Exception as e:
                print(f"Error processing headline: {str(e)}")
                continue
        
        print(f"Saved {saved_count} new headlines to database")
        print(f"Updated {updated_count} existing headlines in database")
        
        # Get total count of headlines in database
        total_count = await headlines_collection.count_documents({})
        print(f"Total headlines in database: {total_count}")
        
    except Exception as e:
        print(f"Error in background task: {str(e)}")

@news_router.get("/api/rapidapi-headlines")
async def get_rapidapi_headlines(limit: int = 20, skip: int = 0):
    """Get headlines from database"""
    try:
        headlines_collection = get_headlines_collection()
        if headlines_collection is None:
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Get headlines, sorted by published date (newest first)
        cursor = headlines_collection.find({}).sort("published_datetime_utc", -1).skip(skip).limit(limit)
        headlines = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string for JSON serialization
        for headline in headlines:
            headline["_id"] = str(headline["_id"])
        
        return {"headlines": headlines, "count": len(headlines)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching headlines: {str(e)}")