from fastapi import FastAPI, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import auth_router
from database import connect_to_mongodb, close_mongodb_connection
from config import settings
from scheduler import setup_scheduler
import uvicorn
import logging
import time
import sentry_sdk

# Import all routes
import routes.users
import routes.admin
import routes.webhooks
import routes.notifications
from routes.virtual_tryon import tryon_router
from routes.products import router as products_router

# Create FastAPI app instance
app = FastAPI(title="VELRA API", 
              description="API for VELRA application",
              version="1.0.0")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Sentry if a DSN is provided
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
    )

# Add CORS middleware here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(tryon_router, tags=["Virtual Try-On"])
app.include_router(products_router)

# Add other routes
app.include_router(routes.users.router)
app.include_router(routes.admin.router)
app.include_router(routes.webhooks.router)
app.include_router(routes.notifications.router)

# Database connection events
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongodb()
    # Set up scheduler after database connection is established
    setup_scheduler()

    # Set up DNS caching for external APIs
    try:
        import socket
        socket.setdefaulttimeout(30)  # Set a reasonable default timeout for all socket operations
    except Exception as e:
        logger.error(f"Failed to set socket timeout: {str(e)}")

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongodb_connection()

@app.get("/")
def read_root():
    return {"message": "Welcome to the VELRA API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"Request: {request.method} {request.url.path} - Duration: {process_time:.3f}s")
    return response

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
