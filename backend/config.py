from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "market_breakdown"
    JWT_SECRET: str = "your-secret-key"
    JWT_ALGORITHM: str = "HS256"
    GOOGLE_CLIENT_ID: str = "960956410891-k6imbmuqgd40hiurti4mes5kp78gvggq.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = "your-google-client-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    EMAIL_USERNAME: str = "your-email@gmail.com"
    EMAIL_PASSWORD: str = "your-app-password"
    FRONTEND_URL: str = "http://localhost:3000"
    DEV_MODE: bool = False  # Set to True to bypass authentication (NEVER use in production)
    
    # News API keys
    MEDIASTACK_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    ALPHAVANTAGE_API_KEY: Optional[str] = None
    FMP_API_KEY: Optional[str] = None
    NEWS_API_KEY: Optional[str] = None
    RAPIDAPI_KEY: Optional[str] = None
    RAPIDAPI_HOST: Optional[str] = "real-time-news-data.p.rapidapi.com"
    
    # RevenueCat Configuration
    REVENUECAT_API_KEY: Optional[str] = None
    REVENUECAT_WEBHOOK_SECRET: Optional[str] = None
    VERIFY_REVENUECAT_WEBHOOK: bool = True
    
    # Monitoring Configuration
    SENTRY_DSN: Optional[str] = None
    API_BASE_URL: Optional[str] = "http://localhost:8001"

    class Config:
        env_file = ".env"

settings = Settings() 