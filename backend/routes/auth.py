from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from models import UserCreate, UserLogin, Token, UserInDB, PasswordResetRequest, PasswordReset, GoogleAuthRequest
from config import settings
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from bson import ObjectId
from database import get_user_collection

auth_router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

# Password reset tokens storage (in-memory for demo, use database in production)
reset_tokens = {}

async def get_user(email: str):
    """Get user from MongoDB by email"""
    users = get_user_collection()
    user_doc = await users.find_one({"email": email})
    if user_doc:
        return UserInDB(**user_doc)
    return None

async def authenticate_user(email: str, password: str):
    """Authenticate user with email and password"""
    users = get_user_collection()
    
    # Get user document directly
    user_doc = await users.find_one({"email": email})
    if not user_doc:
        print(f"User not found: {email}")
        return False
        
    # Check if password hash exists
    if "hashed_password" not in user_doc or not user_doc["hashed_password"]:
        print(f"User has no password hash: {email}")
        return False
    
    # Verify password
    try:
        if not pwd_context.verify(password, user_doc["hashed_password"]):
            print(f"Password verification failed for: {email}")
            return False
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False
        
    # Convert to UserInDB model
    return UserInDB(**user_doc)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
        user = await get_user(email)
        if user is None:
            raise credentials_exception
        return user
    except JWTError:
        raise credentials_exception

@auth_router.post("/register", response_model=Token)
async def register_user(user: UserCreate):
    """Register a new user"""
    # Check if user already exists
    users = get_user_collection()
    existing_user = await users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash the password
    hashed_password = pwd_context.hash(user.password)
    
    # Create user document
    user_dict = user.dict()
    del user_dict["password"]
    user_dict["hashed_password"] = hashed_password
    
    # Insert into database
    await users.insert_one(user_dict)
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, 
        expires_delta=access_token_expires
    )
    
    # Return token with user info
    return Token(
        access_token=access_token,
        email=user.email,
        name=user.name
    )

@auth_router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 compatible token login"""
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, 
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        email=user.email,
        name=user.name
    )

@auth_router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    """Login with email and password"""
    user = await authenticate_user(user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, 
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        email=user.email,
        name=user.name
    )

@auth_router.post("/google", response_model=Token)
async def google_auth(auth_data: GoogleAuthRequest):
    """Handle Google OAuth authentication with authorization code flow"""
    try:
        if not auth_data.code and not auth_data.token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either code or token is required"
            )
            
        # If we have a token, use it directly (mobile flow)
        if auth_data.token:
            # Verify the token with Google
            verify_url = f"https://www.googleapis.com/oauth2/v3/tokeninfo?access_token={auth_data.token}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(verify_url)
                token_info = response.json()
                
                if "error" in token_info:
                    error_detail = token_info.get('error_description', token_info['error'])
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Google token verification error: {error_detail}"
                    )
                
                # Get user info from Google
                user_info_response = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {auth_data.token}"}
                )
                user_info = user_info_response.json()
                
                if "error" in user_info:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to get user info: {user_info.get('error')}"
                    )
        else:
            # Exchange authorization code for tokens (web flow)
            token_url = "https://oauth2.googleapis.com/token"
            token_data = {
                "code": auth_data.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.FRONTEND_URL}/auth/google-callback",
                "grant_type": "authorization_code"
            }
            
            async with httpx.AsyncClient() as client:
                token_response = await client.post(token_url, data=token_data)
                token_info = token_response.json()
                
                if "error" in token_info:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Failed to exchange code: {token_info.get('error')}"
                    )
                
                # Get user info from Google
                user_info_response = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {token_info['access_token']}"}
                )
                user_info = user_info_response.json()
        
        # Check if user exists in our database
        users = get_user_collection()
        existing_user = await users.find_one({"email": user_info["email"]})
            
        if existing_user:
            # Update Google ID if not already set
            if not existing_user.get("google_id"):
                await users.update_one(
                    {"_id": existing_user["_id"]},
                    {"$set": {"google_id": user_info["id"]}}
                )
            user_data = UserInDB(**existing_user)
        else:
            # Create new user
            new_user = {
                "email": user_info["email"],
                "name": user_info.get("name", user_info["email"].split("@")[0]),
                "google_id": user_info["id"]
            }
            result = await users.insert_one(new_user)
            user_data = UserInDB(**new_user)
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_data.email}, 
            expires_delta=access_token_expires
        )
        
        return Token(
            access_token=access_token,
            email=user_data.email,
            name=user_data.name
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions without modification
        raise
    except Exception as e:
        print(f"Error during Google authentication: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during Google authentication: {str(e)}"
        )

@auth_router.post("/forgot-password")
async def forgot_password(request_data: PasswordResetRequest):
    """Send password reset email"""
    user = await get_user(request_data.email)
    if not user:
        # Don't reveal that the user doesn't exist
        return {"message": "If your email is registered, you will receive a password reset link"}
    
    # Generate a reset token
    reset_token = secrets.token_urlsafe(32)
    reset_tokens[reset_token] = {
        "email": user.email,
        "expires": datetime.utcnow() + timedelta(hours=1)
    }
    
    # Create reset link
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    
    # Send email (in production, use a proper email service)
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.EMAIL_USERNAME
        msg['To'] = user.email
        msg['Subject'] = "Password Reset Request"
        
        body = f"""
        Hello {user.name},
        
        You requested a password reset. Please click the link below to reset your password:
        
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you did not request this reset, please ignore this email.
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # For demo purposes, just print the reset link
        print(f"Password reset link for {user.email}: {reset_link}")
        
        # In production, uncomment this to send actual emails
        # server = smtplib.SMTP('smtp.gmail.com', 587)
        # server.starttls()
        # server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
        # text = msg.as_string()
        # server.sendmail(settings.EMAIL_USERNAME, user.email, text)
        # server.quit()
        
        return {"message": "If your email is registered, you will receive a password reset link"}
    
    except Exception as e:
        print(f"Error sending reset email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send reset email"
        )

@auth_router.post("/reset-password")
async def reset_password(reset_data: PasswordReset):
    """Reset password with token"""
    # Check if token exists and is valid
    if reset_data.token not in reset_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )
    
    token_data = reset_tokens[reset_data.token]
    
    # Check if token is expired
    if datetime.utcnow() > token_data["expires"]:
        del reset_tokens[reset_data.token]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token has expired"
        )
    
    # Update user's password
    users = get_user_collection()
    hashed_password = pwd_context.hash(reset_data.password)
    
    result = await users.update_one(
        {"email": token_data["email"]},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password"
        )
    
    # Remove used token
    del reset_tokens[reset_data.token]
    
    return {"message": "Password has been reset successfully"}

@auth_router.get("/me", response_model=UserInDB)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    """Get current user information"""
    return current_user 