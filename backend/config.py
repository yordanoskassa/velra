from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "velra"
    JWT_SECRET: str = "your-secret-key"
    JWT_ALGORITHM: str = "HS256"
    GOOGLE_CLIENT_ID: str = "960956410891-k6imbmuqgd40hiurti4mes5kp78gvggq.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = "your-google-client-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_USERNAME: str = "your-email@gmail.com"
    EMAIL_PASSWORD: str = "your-app-password"
    FRONTEND_URL: str = "http://localhost:3000"
    DEV_MODE: bool = False  # Set to True to bypass authentication (NEVER use in production)
    
    # RevenueCat Configuration
    REVENUECAT_API_KEY: Optional[str] = None
    REVENUECAT_WEBHOOK_SECRET: Optional[str] = None
    VERIFY_REVENUECAT_WEBHOOK: bool = True
    
    # Monitoring Configuration
    SENTRY_DSN: Optional[str] = None
    API_BASE_URL: Optional[str] = "http://localhost:8001"
    
    # FASHN API for Virtual Try-On
    FASHN_API_KEY: Optional[str] = None
    
    # ASOS API for Product Search (RapidAPI)
    ASOS_API_KEY: Optional[str] = None
    ASOS_API_HOST: Optional[str] = "asos-api6.p.rapidapi.com"
    
    # Cloudinary Configuration for temporary image storage
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    USE_CLOUDINARY_FOR_TRYON: bool = False  # Toggle to enable/disable Cloudinary for try-on

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra fields in environment variables

settings = Settings() 