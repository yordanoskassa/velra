from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

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
