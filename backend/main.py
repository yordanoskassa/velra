from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import auth_router
from routes.news import news_router
from database import connect_to_mongodb, close_mongodb_connection
from config import settings
from scheduler import setup_scheduler
import uvicorn

# Create FastAPI app instance
app = FastAPI(title="Market Breakdown API")

# Add CORS middleware here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(news_router, prefix="/news", tags=["News"])

# Database connection events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongodb()
    # Set up scheduler after database connection is established
    setup_scheduler()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongodb_connection()

@app.get("/")
async def root():
    return {"message": "Welcome to the Market Breakdown API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
