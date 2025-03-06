from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    code: str = None
    token: str = None

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

class Article(BaseModel):
    title: str
    content: str = Field(..., min_length=100, description="Article content must be at least 100 characters")
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
