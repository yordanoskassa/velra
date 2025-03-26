from pydantic import BaseModel, validator, Field, EmailStr
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str
    disclaimer_accepted: bool = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    code: str = None
    token: str = None

class AppleAuthRequest(BaseModel):
    identity_token: str
    full_name: Optional[Dict[str, str]] = None  # { givenName, familyName }

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: EmailStr
    name: Optional[str] = None
    id: Optional[str] = None
    username: Optional[str] = None

class UserInDB(UserBase):
    hashed_password: Optional[str] = None
    google_id: Optional[str] = None 
    disclaimer_accepted: bool = False
    saved_articles: List[str] = Field(default_factory=list)  # List of article IDs
    isPremium: bool = False  # Added premium status field

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    name: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    isPremium: bool = False

    class Config:
        orm_mode = True

class Article(BaseModel):
    title: str
    content: str
    url: Optional[str] = None
    publishedAt: Optional[str] = None
    source: Optional[str] = None

class RapidAPIHeadline(BaseModel):
    title: str
    link: str
    snippet: Optional[str] = None
    photo_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    published_datetime_utc: Optional[str] = None
    authors: Optional[List[Union[str, Dict[str, Any]]]] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    source_logo_url: Optional[str] = None
    source_favicon_url: Optional[str] = None
    source_publication_id: Optional[str] = None
    related_topics: Optional[List[Dict[str, Any]]] = None
    sub_articles: Optional[List[Dict[str, Any]]] = None
    story_id: Optional[str] = None
    fetched_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class SubscriptionRequest(BaseModel):
    plan_id: str
    payment_method_id: Optional[str] = None
    coupon_code: Optional[str] = None

class SubscriptionResponse(BaseModel):
    id: Optional[str] = None
    user_id: Optional[str] = None
    plan_id: Optional[str] = None
    status: Optional[str] = None
    current_period_end: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    payment_method: Optional[Dict[str, Any]] = None
    cancel_at_period_end: Optional[bool] = False

class SavedArticleCreate(BaseModel):
    article_id: str
    title: str
    url: str
    image_url: Optional[str] = None
    source: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[datetime] = None

class SavedArticleResponse(BaseModel):
    id: str
    user_id: str
    article_id: str
    title: str
    url: str
    image_url: Optional[str] = None
    source: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        orm_mode = True

class SubscriptionStatus(BaseModel):
    isPremium: bool

# Notification Models
class DeviceToken(BaseModel):
    token: str
    device_type: str = "expo"  # Default to Expo tokens
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

class NotificationPreferences(BaseModel):
    enabled: bool = True
    frequency: str = "daily"  # Options: "hourly", "daily", "weekly"
    categories: List[str] = Field(default_factory=lambda: ["hot_headlines"])
    
class NotificationResponse(BaseModel):
    id: Optional[str] = None
    user_id: str
    preferences: NotificationPreferences
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        orm_mode = True
