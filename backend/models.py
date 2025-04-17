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
    categories: List[str] = Field(default_factory=lambda: ["virtual_tryon", "outfits"])
    
class NotificationResponse(BaseModel):
    id: Optional[str] = None
    user_id: str
    preferences: NotificationPreferences
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        orm_mode = True

# User engagement model to track app usage
class UserEngagement(BaseModel):
    user_id: str
    last_login: datetime = Field(default_factory=datetime.utcnow)
    last_tryon: Optional[datetime] = None
    tryons_count: int = 0
    notification_opens: int = 0
    app_opens_count: int = 0
    inactive_days: int = 0
    favorite_categories: List[str] = Field(default_factory=list)
    
    class Config:
        orm_mode = True

# Model to track virtual try-on API usage
class TryonUsage(BaseModel):
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    daily_count: int = 0
    monthly_count: int = 0
    total_count: int = 0
    last_reset_daily: datetime = Field(default_factory=datetime.utcnow)
    last_reset_monthly: datetime = Field(default_factory=datetime.utcnow)
    last_used: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        orm_mode = True

class DeviceBasedRequest(BaseModel):
    device_id: str
    app_version: Optional[str] = None
    device_model: Optional[str] = None
    os_version: Optional[str] = None
    sync_only: Optional[bool] = False
    force_db_check: Optional[bool] = False
    check_only: Optional[bool] = False
    is_subscribed: Optional[bool] = False
    current_counts: Optional[Dict[str, int]] = Field(default_factory=dict)
