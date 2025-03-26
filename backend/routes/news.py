from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, status
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
from database import get_headlines_collection, get_user_collection, get_mongodb_connection
from config import settings
from routes.auth import get_current_user, UserInDB, is_admin
from bson import ObjectId
import logging

# Configure logging
logger = logging.getLogger(__name__)

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
    try:
        # Log the article details
        print(f"Generating insights for article: '{article.title}' with content length: {len(article.content)}")
        
        # Check if content is too short
        if len(article.content) < 20:
            print(f"Article content is too short ({len(article.content)} chars), adding minimal context")
            article.content = article.content + " This is a news article about financial markets."
        
        prompt = f"""Analyze this financial news article and provide structured market insights. 
        
Article details:
Title: {article.title if article.title else 'No Title'}
Content: {article.content}
Source: {article.source if article.source else 'Unknown Source'}
Published At: {article.publishedAt if article.publishedAt else 'Unknown Date'}

Your task is to analyze this article and provide insights in the following JSON format:
{{
    "key_points": [
        "First key point about the article",
        "Second key point about the article",
        "Third key point about the article"
    ],
    "potential_impact": {{
        "stocks": {{
            "description": "Detailed analysis of how this news might impact stock markets. Include specific numerical predictions (e.g., 'XYZ stock could rise by 3.5%', 'Expect a 2-4% decline in the sector')",
            "impact_level": "high/medium/low" 
        }},
        "commodities": {{
            "description": "Detailed analysis of how this news might impact commodity markets. Include specific numerical predictions (e.g., 'Gold prices may increase 1.2%', 'Oil could stabilize around $75-80/barrel')",
            "impact_level": "high/medium/low"
        }},
        "forex": {{
            "description": "Detailed analysis of how this news might impact forex markets. Include specific numerical predictions (e.g., 'USD/EUR might strengthen by 0.8%', 'JPY could weaken 1.5-2% against major currencies')",
            "impact_level": "high/medium/low"
        }}
    }},
    "recommended_actions": [
        "First recommended action for investors",
        "Second recommended action for investors"
    ],
    "confidence_score": 75
}}

Important notes:
1. IMPORTANT: Do NOT include any impact percentages, confidence scores, or numerical predictions in key_points or recommended_actions sections
2. Key points and recommended actions should be purely qualitative without percentages or numbers
3. For each potential_impact section (stocks, commodities, forex), set an impact_level of "high", "medium", or "low":
   - "high": Major market-moving news likely to cause significant price changes
   - "medium": Moderate impact on prices or relevant to specific sectors only
   - "low": Minor impact or too indirect to cause immediate market reaction
4. Ensure approximately 1/5 of the content in the potential_impact sections includes specific numbers, percentages, or numerical predictions
5. Use positive/negative numerical values in potential_impact sections (e.g., "+2.5% growth", "-3% decline") to clearly indicate direction
6. The confidence_score should be between 0 and 100 based on how confident you are in your analysis
7. Your response should be ONLY the JSON object, nothing else
8. Make sure your response is valid JSON that can be parsed
9. If the article is too short or lacks sufficient information, provide insights based on what is available
"""

        print(f"Sending prompt to Gemini API for article: {article.title}")
        print(f"Gemini API key status: {'Available' if gemini_api_key else 'Missing'}")
        print(f"Using Gemini model: {gemini_model.model_name}")
        
        try:
            response = await asyncio.wait_for(
                gemini_model.generate_content_async(prompt),
                timeout=20.0
            )
            
            if not response.text:
                print("Empty response from Gemini API")
                raise ValueError("Empty response from Gemini API")
            
            print(f"Received response from Gemini API: {response.text[:100]}...")
            
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
                                "stocks": {
                                    "description": "Impact analysis unavailable",
                                    "impact_level": "unknown"
                                },
                                "commodities": {
                                    "description": "Impact analysis unavailable",
                                    "impact_level": "unknown"
                                },
                                "forex": {
                                    "description": "Impact analysis unavailable",
                                    "impact_level": "unknown"
                                }
                            }
                        elif key == "recommended_actions":
                            parsed_response["recommended_actions"] = ["No recommended actions provided"]
                
                # Ensure key_points is an array
                if not isinstance(parsed_response.get("key_points", []), list):
                    parsed_response["key_points"] = [str(parsed_response["key_points"])]
                    
                # Ensure recommended_actions is an array
                if not isinstance(parsed_response.get("recommended_actions", []), list):
                    parsed_response["recommended_actions"] = [str(parsed_response["recommended_actions"])]

                # Ensure potential_impact is an object
                if not isinstance(parsed_response.get("potential_impact", {}), dict):
                    parsed_response["potential_impact"] = {
                        "stocks": {
                            "description": "Impact analysis unavailable",
                            "impact_level": "unknown"
                        },
                        "commodities": {
                            "description": "Impact analysis unavailable",
                            "impact_level": "unknown"
                        },
                        "forex": {
                            "description": "Impact analysis unavailable",
                            "impact_level": "unknown"
                        }
                    }
                    
                # Add confidence score if missing
                if "confidence_score" not in parsed_response:
                    parsed_response["confidence_score"] = random.randint(40, 90)
                
                print(f"Successfully generated insights for article: {article.title}")
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
                        print(f"Successfully extracted JSON from response text")
                        return parsed_response
                    except json.JSONDecodeError:
                        print(f"Failed to parse extracted JSON")
                
                # If all parsing attempts fail, return a structured error with the raw response
                return {
                    "error": "Failed to parse analysis",
                    "raw_response": response_text,
                    "key_points": [
                        "Unable to parse detailed insights from the AI response.",
                        "Consider reviewing the article manually for market implications.",
                        "The system is still learning to analyze this type of content."
                    ],
                    "potential_impact": {
                        "stocks": {
                            "description": "Impact analysis unavailable",
                            "impact_level": "unknown"
                        },
                        "commodities": {
                            "description": "Impact analysis unavailable",
                            "impact_level": "unknown"
                        },
                        "forex": {
                            "description": "Impact analysis unavailable",
                            "impact_level": "unknown"
                        }
                    },
                    "recommended_actions": ["Review article manually"],
                    "confidence_score": 50
                }
        except asyncio.TimeoutError:
            print("Gemini API request timed out")
            raise HTTPException(
                status_code=504,
                detail="Analysis request timed out. Please try again."
            )
        except Exception as e:
            print(f"Gemini API error: {str(e)}")
            print(f"Prompt: {prompt[:200]}...")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate insights: {str(e)}"
            )
    except Exception as e:
        print(f"Unexpected error in generate_gemini_insights: {str(e)}")
        # Return a valid response structure even in case of errors
        return {
            "error": f"Failed to generate insights: {str(e)}",
            "key_points": [
                "Unable to generate insights due to a technical issue.",
                "Please try again later."
            ],
            "potential_impact": {
                "stocks": {
                    "description": "Impact analysis unavailable",
                    "impact_level": "unknown"
                },
                "commodities": {
                    "description": "Impact analysis unavailable",
                    "impact_level": "unknown"
                },
                "forex": {
                    "description": "Impact analysis unavailable",
                    "impact_level": "unknown"
                }
            },
            "recommended_actions": ["Try again later"],
            "confidence_score": 0
        }

@news_router.post("/api/insights")
async def get_insights(article: Article):
    """Alias for generate_gemini_insights to maintain compatibility with frontend"""
    return await generate_gemini_insights(article)

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

# New endpoints for saved articles
@news_router.post("/api/save-article/{article_id}")
async def save_article(article_id: str, current_user: UserInDB = Depends(get_current_user)):
    """Save an article for a logged-in user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    print(f"Attempting to save article with ID: {article_id} for user: {current_user.email}")
    
    users_collection = get_user_collection()
    headlines_collection = get_headlines_collection()
    
    try:
        article = None
        # Try various methods to find the article
        
        # 1. Try direct string ID match
        print(f"Looking up article with string ID: {article_id}")
        article = await headlines_collection.find_one({"_id": article_id})
            
        # 2. Try with ObjectId if valid
        if not article and ObjectId.is_valid(article_id):
            mongo_id = ObjectId(article_id)
            print(f"Looking up article with MongoDB ObjectId: {mongo_id}")
            article = await headlines_collection.find_one({"_id": mongo_id})
            
        # 3. Try by link (partial match)
        if not article:
            print(f"Looking up article by link containing: {article_id}")
            article = await headlines_collection.find_one({"link": {"$regex": article_id, "$options": "i"}})
            
        # 4. As a last resort, check if an article with this title exists
        if not article:
            print(f"Looking up article by title containing: {article_id}")
            article = await headlines_collection.find_one({"title": {"$regex": article_id, "$options": "i"}})
            
        # If we still can't find the article, insert a placeholder
        if not article:
            print(f"Article not found, creating a placeholder")
            placeholder_id = article_id if not ObjectId.is_valid(article_id) else str(ObjectId(article_id))
            # Just add the ID to the user's saved articles without trying to validate
            await users_collection.update_one(
                {"email": current_user.email},
                {"$addToSet": {"saved_articles": placeholder_id}}
            )
            return {"status": "success", "message": "Article ID saved (no article found)", "placeholder": True}
        
        # Get the actual stored ID from the article
        stored_id = str(article["_id"])
        
        # Add article_id to user's saved_articles if not already there
        if not current_user.saved_articles or stored_id not in current_user.saved_articles:
            print(f"Adding article {stored_id} to user's saved articles")
            await users_collection.update_one(
                {"email": current_user.email},
                {"$addToSet": {"saved_articles": stored_id}}
            )
            return {"status": "success", "message": "Article saved successfully"}
        else:
            print(f"Article already saved for this user")
            return {"status": "success", "message": "Article already saved"}
            
    except Exception as e:
        print(f"Error saving article: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving article: {str(e)}")

@news_router.delete("/api/save-article/{article_id}")
async def unsave_article(article_id: str, current_user: UserInDB = Depends(get_current_user)):
    """Remove a saved article for a logged-in user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    print(f"Attempting to unsave article with ID: {article_id} for user: {current_user.email}")
    
    users_collection = get_user_collection()
    
    try:
        # Try to convert to ObjectId if it's not already
        if ObjectId.is_valid(article_id):
            mongo_id = ObjectId(article_id)
            print(f"Converting article ID to MongoDB ObjectId: {mongo_id}")
            # For deletion, we need to check if the string representation is in the user's saved articles
            str_id = str(mongo_id)
        else:
            # Use the string ID directly
            str_id = article_id
            
        print(f"Removing article ID {str_id} from user's saved articles")
        
        # Remove article_id from user's saved_articles
        await users_collection.update_one(
            {"email": current_user.email},
            {"$pull": {"saved_articles": str_id}}
        )
        
        return {"status": "success", "message": "Article removed from saved"}
    except Exception as e:
        print(f"Error unsaving article: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error unsaving article: {str(e)}")

@news_router.get("/api/saved-articles")
async def get_saved_articles(current_user: UserInDB = Depends(get_current_user)):
    """Get all saved articles for a logged-in user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    print(f"Getting saved articles for user: {current_user.email}")
    
    # Get the user's saved article IDs
    saved_article_ids = current_user.saved_articles
    
    print(f"User has {len(saved_article_ids)} saved article IDs")
    
    # If no saved articles, return empty list
    if not saved_article_ids:
        return {"articles": [], "status": "ok", "totalResults": 0}
    
    # Get the headlines from the collection
    headlines_collection = get_headlines_collection()
    saved_articles = []
    not_found_ids = []
    
    try:
        for article_id in saved_article_ids:
            print(f"Fetching article with ID: {article_id}")
            
            headline = None
            # Try first with the string ID
            headline = await headlines_collection.find_one({"_id": article_id})
            
            # If not found, try converting to ObjectId
            if not headline and ObjectId.is_valid(article_id):
                try:
                    mongo_id = ObjectId(article_id)
                    print(f"Trying with MongoDB ObjectId: {mongo_id}")
                    headline = await headlines_collection.find_one({"_id": mongo_id})
                except Exception as e:
                    print(f"Error converting ID to ObjectId: {str(e)}")
            
            if headline:
                # Convert MongoDB ObjectId to string for JSON serialization
                headline["_id"] = str(headline["_id"])
                
                # Convert to the format expected by the frontend
                article = {
                    "id": headline["_id"],
                    "title": headline.get("title", "Untitled"),
                    "url": headline.get("link", ""),
                    "urlToImage": headline.get("photo_url") or headline.get("thumbnail_url"),
                    "publishedAt": headline.get("published_datetime_utc", ""),
                    "content": headline.get("snippet", ""),
                    "source": {
                        "name": headline.get("source_name", "") or "News Source"
                    },
                    "author": ", ".join(headline["authors"]) if isinstance(headline.get("authors", []), list) else headline.get("authors", ""),
                    "category": "business",
                    "sentiment": "neutral"
                }
                saved_articles.append(article)
                print(f"Added article to results: {article['title'][:50]}...")
            else:
                not_found_ids.append(article_id)
                print(f"Article with ID {article_id} not found in database")
        
        # If there were IDs that couldn't be found, log them
        if not_found_ids:
            print(f"Could not find {len(not_found_ids)} articles: {not_found_ids}")
            
            # Clean up user's saved articles by removing non-existent IDs
            if len(not_found_ids) > 0:
                users_collection = get_user_collection()
                for invalid_id in not_found_ids:
                    await users_collection.update_one(
                        {"email": current_user.email},
                        {"$pull": {"saved_articles": invalid_id}}
                    )
                print(f"Removed {len(not_found_ids)} invalid article IDs from user's saved articles")
        
        print(f"Returning {len(saved_articles)} saved articles")
        return {"articles": saved_articles, "status": "ok", "totalResults": len(saved_articles)}
    except Exception as e:
        print(f"Error getting saved articles: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting saved articles: {str(e)}")

@news_router.get("/api/article-saved/{article_id}")
async def check_article_saved(article_id: str, current_user: UserInDB = Depends(get_current_user)):
    """Check if an article is saved by the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    print(f"Checking if article {article_id} is saved by user {current_user.email}")
    
    try:
        # Try to convert to ObjectId if it's not already
        if ObjectId.is_valid(article_id):
            mongo_id = ObjectId(article_id)
            print(f"Converting article ID to MongoDB ObjectId: {mongo_id}")
            # Check both the ObjectId string and original string in the user's saved articles
            str_id = str(mongo_id)
            is_saved = str_id in current_user.saved_articles or article_id in current_user.saved_articles
        else:
            # Use the string ID directly
            is_saved = article_id in current_user.saved_articles
            
        print(f"Article {article_id} saved status: {is_saved}")
        return {"status": "success", "is_saved": is_saved}
    except Exception as e:
        print(f"Error checking article saved status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking saved status: {str(e)}")

# Update keywords for different categories based on user requirements
WEEKLY_PICKS_KEYWORDS = {
    "economicIndicators": [
        "inflation", "jobs report", "GDP", "unemployment", "interest rates",
        "economic growth", "consumer spending", "retail sales", "housing market"
    ],
    "centralBank": [
        "Federal Reserve", "Fed", "rate hike", "Powell", "ECB", "central bank",
        "monetary policy", "interest rate decision", "FOMC", "rate cut"
    ],
    "earnings": [
        "earnings", "revenue", "profit", "quarterly results", "guidance",
        "earnings report", "financial results", "earnings growth", "earnings miss",
        "earnings beat", "earnings per share", "EPS"
    ],
    "corporateActions": [
        "merger", "acquisition", "bankruptcy", "layoffs", "lawsuit",
        "restructuring", "spin-off", "stock split", "dividend", "buyback",
        "IPO", "joint venture", "takeover"
    ],
    "globalGeopolitical": [
        "trade war", "sanctions", "conflict", "tariffs", "diplomatic",
        "geopolitical", "international relations", "global trade", "trade deal",
        "political risk"
    ]
}

@news_router.get("/api/news/weekly-picks")
async def get_weekly_picks(debug: bool = False):
    """Get weekly picks based on predefined keywords with very flexible matching"""
    try:
        # Get the headlines collection
        headlines_collection = get_headlines_collection()
        
        # Query articles without date restriction, just get the most recent ones
        pipeline = [
            {
                "$sort": {
                    # Sort by date if available, otherwise by other fields as fallback
                    "published_datetime_utc": -1
                }
            },
            {
                "$limit": 500  # Increased limit to get more articles for processing
            },
            {
                "$addFields": {
                    "combined_text": {
                        "$concat": [
                            {"$ifNull": ["$title", ""]},
                            " ",
                            {"$ifNull": ["$snippet", ""]},
                            " ",
                            {"$ifNull": ["$description", ""]}
                        ]
                    }
                }
            }
        ]
        
        articles = await headlines_collection.aggregate(pipeline).to_list(500)
        print(f"Found {len(articles)} articles for processing")
        
        # If debug mode is enabled and no articles found, return empty with some debug info
        if debug and not articles:
            # Get total count without time restriction
            total_count = await headlines_collection.count_documents({})
            return {
                "articles": [],
                "debug": {
                    "total_articles_in_db": total_count,
                    "articles_found": 0,
                    "error": "No articles found in the database"
                }
            }
        
        # If no articles found at all but not in debug mode, return empty array
        if not articles:
            return {"articles": []}
            
        # If debug mode is enabled, get a sample article for debugging
        if debug:
            sample_article = articles[0] if articles else None
            if sample_article:
                # Make a copy to avoid modifying the original
                sample_article_copy = sample_article.copy()
                # Convert ObjectId to string
                if '_id' in sample_article_copy and sample_article_copy['_id'] is not None:
                    sample_article_copy['_id'] = str(sample_article_copy['_id'])
                    
                print(f"Sample article title: {sample_article_copy.get('title', 'No Title')}")
                print(f"Sample article date: {sample_article_copy.get('published_datetime_utc', 'No Date')}")
        
        # Filter articles based on keywords with extremely flexible matching
        filtered_articles = []
        
        # Make all keywords lowercase
        simplified_keywords = {}
        for category, keywords_list in WEEKLY_PICKS_KEYWORDS.items():
            simplified_keywords[category] = [kw.lower() for kw in keywords_list]
        
        # Add some single-word keywords for more flexible matching
        single_word_keywords = {
            "economicIndicators": ["economy", "economic", "inflation", "GDP", "growth", "recession", "market", "earnings", "price", "index", "cost", "wage"],
            "centralBank": ["Fed", "federal", "reserve", "Powell", "ECB", "rate", "interest", "monetary", "bank", "finance", "fiscal"],
            "earnings": ["earnings", "profit", "revenue", "quarterly", "financial", "results", "report", "stock", "shares", "increase", "decrease"],
            "corporateActions": ["merger", "acquisition", "buyback", "dividend", "IPO", "bankruptcy", "lawsuit", "CEO", "board", "company", "business"],
            "globalGeopolitical": ["trade", "tariff", "sanction", "conflict", "global", "international", "diplomatic", "relations", "agreement", "president", "government"]
        }
        
        # Merge single word keywords with the regular keywords
        for category, keywords in single_word_keywords.items():
            if category in simplified_keywords:
                simplified_keywords[category].extend(keywords)
        
        # Track articles that couldn't be matched
        unmatched_articles = []
        matched_count = 0
        
        for article in articles:
            # Skip articles without basic content
            if not article.get('title') and not article.get('snippet') and not article.get('combined_text'):
                continue
                
            # Get article text to match against
            text_to_match = article.get("combined_text", "").lower()
            if not text_to_match:
                # If combined_text is empty, use title and snippet directly
                title = article.get("title", "").lower()
                snippet = article.get("snippet", "").lower()
                text_to_match = f"{title} {snippet}"
            
            # Skip if still no text to match
            if not text_to_match:
                continue
            
            # Track matching categories
            matching_categories = []
            
            # Check if article matches any keywords with more flexible matching
            for category, category_keywords in simplified_keywords.items():
                for keyword in category_keywords:
                    # Try exact match first (even partial word matches)
                    if keyword in text_to_match:
                        if category not in matching_categories:
                            matching_categories.append(category)
                            # Once we find a match for this category, no need to check more keywords
                            break
                
                # Continue to next category if we already have a match
                if category in matching_categories:
                    continue
                    
                # If no direct keyword matches, try more aggressive matching with multi-word keywords
                multi_word_keywords = [k for k in category_keywords if ' ' in k]
                for keyword in multi_word_keywords:
                    keyword_words = keyword.split()
                    # Consider it a match if at least one word is present (very loose matching)
                    matches = sum(1 for word in keyword_words if len(word) > 3 and word in text_to_match)
                    if matches > 0:  # Only need one word to match
                        if category not in matching_categories:
                            matching_categories.append(category)
                            break
            
            # If article matched any categories, add it to filtered articles
            if matching_categories:
                # Add the matching categories to the article
                article['weekly_pick_categories'] = matching_categories
                filtered_articles.append(article)
                matched_count += 1
                
                # Print every 10th match for debugging
                if matched_count % 10 == 0:
                    print(f"Matched {matched_count} articles so far...")
            else:
                # Keep track of unmatched articles for debugging
                unmatched_articles.append({
                    "title": article.get("title", "")[:50],
                    "text": text_to_match[:100] + "..."
                })
        
        print(f"Filtered to {len(filtered_articles)} articles based on keywords")
        
        # Sort by date (most recent first) if available
        filtered_articles.sort(
            key=lambda x: x.get('published_datetime_utc', datetime.min) 
            if isinstance(x.get('published_datetime_utc'), datetime) 
            else datetime.min, 
            reverse=True
        )
        
        # If no articles found or fewer than 10, use the most recent articles
        if len(filtered_articles) < 10 and articles:
            print("Too few articles matched keywords, adding more recent articles")
            # Find articles that aren't already in filtered_articles
            for article in articles:
                if len(filtered_articles) >= 20:  # Stop once we have 20 articles
                    break
                    
                # Check if this article is already in filtered_articles
                article_id = str(article.get('_id', ''))
                if not any(str(a.get('_id', '')) == article_id for a in filtered_articles):
                    # Add a generic category
                    article['weekly_pick_categories'] = ["recent"]
                    filtered_articles.append(article)
        
        # Take the top 20 articles
        top_articles = filtered_articles[:20]
        
        # Convert ObjectId to string for JSON serialization and perform additional error checking
        for article in top_articles:
            if '_id' in article and article['_id'] is not None:
                article['_id'] = str(article['_id'])
            else:
                # Generate a temporary ID if missing
                article['_id'] = str(ObjectId())
                print(f"Warning: Article missing _id field: {article.get('title', 'Unknown title')}")
        
        # If debug mode is enabled, add debugging information
        if debug:
            return {
                "articles": top_articles,
                "debug": {
                    "total_articles_in_db": await headlines_collection.count_documents({}),
                    "articles_processed": len(articles),
                    "matched_articles": len(filtered_articles),
                    "unmatched_sample": unmatched_articles[:5] if unmatched_articles else [],
                    "sample_article": sample_article_copy if 'sample_article_copy' in locals() else None,
                    "keywords": simplified_keywords
                }
            }
        
        return {"articles": top_articles}
        
    except Exception as e:
        print(f"Error in get_weekly_picks: {str(e)}")
        if debug:
            import traceback
            return {
                "articles": [],
                "debug": {
                    "error": str(e),
                    "traceback": traceback.format_exc()
                }
            }
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch weekly picks: {str(e)}"
        )

@news_router.put("/headlines/{headline_id}/mark-hot", response_model=Dict[str, Any])
async def mark_headline_as_hot(
    headline_id: str,
    is_hot: bool = True,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Mark a headline as 'hot' for notifications"""
    try:
        # Verify admin privileges
        if not await is_admin(current_user, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin users can mark headlines as hot"
            )
            
        # Get headlines collection
        headlines_collection = db["headlines"]
        
        # Convert the headline_id to ObjectId
        try:
            headline_oid = ObjectId(headline_id)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid headline ID format"
            )
        
        # Check if headline exists
        headline = await headlines_collection.find_one({"_id": headline_oid})
        if not headline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Headline not found"
            )
            
        # Update the headline to mark it as hot
        result = await headlines_collection.update_one(
            {"_id": headline_oid},
            {"$set": {"is_hot": is_hot, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count == 0:
            return {
                "success": True,
                "message": f"Headline was already {'hot' if is_hot else 'not hot'}",
                "headline_id": headline_id
            }
            
        return {
            "success": True,
            "message": f"Headline marked as {'hot' if is_hot else 'not hot'}",
            "headline_id": headline_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking headline as hot: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark headline as hot: {str(e)}"
        )

@news_router.get("/headlines/hot", response_model=List[Dict[str, Any]])
async def get_hot_headlines(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_mongodb_connection)
):
    """Get hot headlines for notifications"""
    try:
        # Get headlines collection
        headlines_collection = db["headlines"]
        
        # Get hot headlines
        hot_headlines = await headlines_collection.find(
            {"is_hot": True}
        ).sort("publishedAt", -1).limit(limit).to_list(length=limit)
        
        # Format the headlines
        formatted_headlines = []
        for headline in hot_headlines:
            headline["id"] = str(headline["_id"])
            del headline["_id"]
            formatted_headlines.append(headline)
            
        return formatted_headlines
        
    except Exception as e:
        logger.error(f"Error getting hot headlines: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hot headlines: {str(e)}"
        )