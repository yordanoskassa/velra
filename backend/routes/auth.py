from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from models import UserCreate, UserLogin, Token, UserInDB, PasswordResetRequest, PasswordReset, GoogleAuthRequest, SubscriptionRequest, SubscriptionResponse, AppleAuthRequest
from config import settings
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from bson import ObjectId
from database import get_user_collection
import uuid
import base64
import json

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

async def is_admin(user: UserInDB, db):
    """Check if a user has admin privileges"""
    try:
        # Get user document to check for admin flag
        if not user or not user.email:
            return False
            
        users_collection = db["users"]
        user_doc = await users_collection.find_one({"email": user.email})
        
        if not user_doc:
            return False
            
        # Check if user has admin flag set to true
        return user_doc.get("is_admin", False) == True
    except Exception as e:
        print(f"Error checking admin status: {str(e)}")
        return False

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
    user_dict["created_at"] = datetime.utcnow()
    
    # Ensure disclaimer is accepted
    if not user_dict.get("disclaimer_accepted", False):
        raise HTTPException(status_code=400, detail="You must accept the disclaimer to register")
    
    # Insert the user
    result = await users.insert_one(user_dict)
    
    # Create access token
    user_id = str(result.inserted_id)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    # Return token and user info
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "email": user.email,
        "name": user.name,
        "id": user_id,
        "disclaimer_accepted": user_dict.get("disclaimer_accepted", False)
    }

@auth_router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 compatible token login, get an access token for future requests"""
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "name": user.name, "is_premium": user.is_premium if hasattr(user, "is_premium") else False}, 
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token, 
        token_type="bearer", 
        email=user.email, 
        name=user.name,
        id=str(user.id) if hasattr(user, "id") else None,
        is_premium=user.is_premium if hasattr(user, "is_premium") else False
    )

@auth_router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    """Login with email and password, get an access token for future requests"""
    user = await authenticate_user(user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "name": user.name, "is_premium": user.is_premium if hasattr(user, "is_premium") else False}, 
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token, 
        token_type="bearer", 
        email=user.email, 
        name=user.name,
        id=str(user.id) if hasattr(user, "id") else None,
        is_premium=user.is_premium if hasattr(user, "is_premium") else False
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


@auth_router.post("/logout")
async def logout(request: Request):
    """Logout user by invalidating their token"""
    # Get the authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No valid authentication token found"
        )
    
    token = auth_header.split(' ')[1]
    
    try:
        # Decode token to get user info
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate token"
            )
            
        # Add token to blacklist in database
        users = get_user_collection()
        await users.update_one(
            {"email": email},
            {"$push": {"invalidated_tokens": {
                "token": token,
                "invalidated_at": datetime.utcnow()
            }}}
        )
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token"
        )
    # In a real application, you would invalidate the token here
    # For now, we'll just return a success message
    return {"message": "Logged out successfully"}


@auth_router.delete("/delete-account")
async def delete_account(request: Request):
    """Delete user account"""
    try:
        # Get the authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No valid authentication token found"
            )
        
        token = auth_header.split(' ')[1]
        
        try:
            # Decode token to get user info
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            email = payload.get("sub")
            
            if email is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate token"
                )
            
            # Check if user exists
            users = get_user_collection()
            user = await users.find_one({"email": email})
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            # Delete user from database
            result = await users.delete_one({"email": email})
            
            if result.deleted_count == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found or already deleted"
                )
            
            print(f"Successfully deleted account for: {email}")
            return {"message": "Account deleted successfully"}
            
        except JWTError as jwt_error:
            print(f"JWT error: {jwt_error}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )
    
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise http_ex
    except Exception as e:
        print(f"Error deleting account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete account: {str(e)}"
        )
    
@auth_router.post("/subscription", response_model=SubscriptionResponse)
async def create_subscription(subscription_data: SubscriptionRequest, current_user: UserInDB = Depends(get_current_user)):
    """Create a new subscription for the user"""
    try:
        users = get_user_collection()
        
        # Generate a subscription ID
        subscription_id = str(uuid.uuid4())
        
        # Set subscription dates
        start_date = datetime.utcnow()
        
        # Default to monthly subscription (30 days)
        days_to_add = 30
        if subscription_data.subscription_plan == "yearly":
            days_to_add = 365
            
        end_date = start_date + timedelta(days=days_to_add)
        
        # Handle Apple Pay receipt verification
        verified = False
        if subscription_data.payment_method == "apple_pay" and subscription_data.receipt_data:
            # In a real implementation, you would verify the receipt with Apple's servers
            # For now, we'll simulate a successful verification
            verified = True
            
            # Example of how to verify with Apple (pseudo-code):
            # response = await httpx.post(
            #     "https://sandbox.itunes.apple.com/verifyReceipt",  # Use production URL in production
            #     json={"receipt-data": subscription_data.receipt_data}
            # )
            # if response.status_code == 200:
            #     receipt_info = response.json()
            #     if receipt_info.get("status") == 0:  # 0 means success
            #         verified = True
        else:
            # For testing purposes, consider any other payment method as verified
            verified = True
        
        if not verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment verification failed"
            )
        
        # Update user with subscription information
        update_result = await users.update_one(
            {"email": current_user.email},
            {
                "$set": {
                    "is_premium": True,
                    "subscription_id": subscription_id,
                    "subscription_start_date": start_date,
                    "subscription_end_date": end_date,
                    "subscription_status": "active",
                    "payment_method": subscription_data.payment_method
                }
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update subscription information"
            )
        
        return SubscriptionResponse(
            is_premium=True,
            subscription_id=subscription_id,
            subscription_start_date=start_date,
            subscription_end_date=end_date,
            subscription_status="active",
            message="Subscription created successfully"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating subscription: {str(e)}"
        )

@auth_router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(current_user: UserInDB = Depends(get_current_user)):
    """Get the user's current subscription status"""
    try:
        # Check if user has subscription information
        if not hasattr(current_user, "is_premium") or not current_user.is_premium:
            return SubscriptionResponse(
                is_premium=False,
                message="User does not have an active subscription"
            )
        
        # Check if subscription has expired
        if hasattr(current_user, "subscription_end_date") and current_user.subscription_end_date:
            if current_user.subscription_end_date < datetime.utcnow():
                # Subscription has expired, update user record
                users = get_user_collection()
                await users.update_one(
                    {"email": current_user.email},
                    {
                        "$set": {
                            "is_premium": False,
                            "subscription_status": "expired"
                        }
                    }
                )
                
                return SubscriptionResponse(
                    is_premium=False,
                    subscription_id=current_user.subscription_id,
                    subscription_start_date=current_user.subscription_start_date,
                    subscription_end_date=current_user.subscription_end_date,
                    subscription_status="expired",
                    message="Subscription has expired"
                )
        
        # Return active subscription details
        return SubscriptionResponse(
            is_premium=current_user.is_premium,
            subscription_id=current_user.subscription_id if hasattr(current_user, "subscription_id") else None,
            subscription_start_date=current_user.subscription_start_date if hasattr(current_user, "subscription_start_date") else None,
            subscription_end_date=current_user.subscription_end_date if hasattr(current_user, "subscription_end_date") else None,
            subscription_status=current_user.subscription_status if hasattr(current_user, "subscription_status") else None,
            message="Active subscription found"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving subscription: {str(e)}"
        )

@auth_router.delete("/subscription", response_model=SubscriptionResponse)
async def cancel_subscription(current_user: UserInDB = Depends(get_current_user)):
    """Cancel the user's subscription"""
    try:
        users = get_user_collection()
        
        # Check if user has an active subscription
        if not hasattr(current_user, "is_premium") or not current_user.is_premium:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User does not have an active subscription to cancel"
            )
        
        # Update user record to cancel subscription
        update_result = await users.update_one(
            {"email": current_user.email},
            {
                "$set": {
                    "subscription_status": "canceled"
                    # Note: We're not setting is_premium to False immediately
                    # The user can continue to use premium features until the end date
                }
            }
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to cancel subscription"
            )
        
        return SubscriptionResponse(
            is_premium=True,  # Still premium until end date
            subscription_id=current_user.subscription_id if hasattr(current_user, "subscription_id") else None,
            subscription_start_date=current_user.subscription_start_date if hasattr(current_user, "subscription_start_date") else None,
            subscription_end_date=current_user.subscription_end_date if hasattr(current_user, "subscription_end_date") else None,
            subscription_status="canceled",
            message="Subscription has been canceled but will remain active until the end date"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error canceling subscription: {str(e)}"
        )
    
@auth_router.post("/apple", response_model=Token)
async def apple_auth(request: Request):
    """Handle Apple OAuth authentication"""
    try:
        # Get raw request data
        raw_data = await request.json()
        print(f"Apple auth - received raw data: {raw_data}")
        
        # Extract identity token from request data - handle both field naming conventions
        identity_token = raw_data.get('identity_token') or raw_data.get('identityToken')
        if not identity_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing identity token in request"
            )
            
        # Extract optional full name data
        full_name = raw_data.get('full_name') or raw_data.get('fullName')
        
        # Verify the identity token with Apple
        # In a production environment, you should verify the token with Apple's servers
        # For now, we'll extract the user info from the token
        
        # Parse the identity token (JWT)
        try:
            # Split the token into header, payload, and signature
            header, payload, signature = identity_token.split('.')
            
            # Decode the payload
            # Add padding if needed
            payload += '=' * ((4 - len(payload) % 4) % 4)
            decoded_payload = json.loads(base64.b64decode(payload).decode('utf-8'))
            
            print(f"Decoded Apple token payload: {decoded_payload}")
            
            # Extract user info
            apple_user_id = decoded_payload.get('sub')
            email = decoded_payload.get('email')
            
            if not apple_user_id or not email:
                print(f"Invalid Apple token: missing sub({apple_user_id}) or email({email})")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Apple identity token"
                )
                
        except Exception as e:
            print(f"Exception parsing Apple token: {e}")
            print(f"Token format: {identity_token[:20]}...")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse Apple identity token: {str(e)}"
            )
        
        # Check if user exists in our database
        users = get_user_collection()
        existing_user = await users.find_one({"email": email})
        
        if existing_user:
            # User exists, create a token
            user_id = str(existing_user["_id"])
            user_name = existing_user.get("name", "")
            is_premium = existing_user.get("is_premium", False)
        else:
            # Create a new user
            # Use the name from the request if provided
            name = ""
            if full_name:
                name_parts = []
                if full_name.get("givenName"):
                    name_parts.append(full_name.get("givenName"))
                if full_name.get("familyName"):
                    name_parts.append(full_name.get("familyName"))
                name = " ".join(name_parts)
            
            # If name is still empty, use email as name
            if not name:
                name = email.split('@')[0]
                
            # Create user document
            user_dict = {
                "email": email,
                "name": name,
                "apple_user_id": apple_user_id,
                "created_at": datetime.utcnow(),
                "disclaimer_accepted": True,  # Always set disclaimer as accepted for Apple sign-in
                "is_premium": False
            }
            
            print(f"Creating new user via Apple Sign-In with disclaimer_accepted=True: {email}")
            
            # Insert the user
            result = await users.insert_one(user_dict)
            user_id = str(result.inserted_id)
            user_name = name
            is_premium = False
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": email, "name": user_name, "is_premium": is_premium},
            expires_delta=access_token_expires
        )
        
        # Return token and user info
        return Token(
            access_token=access_token,
            token_type="bearer",
            email=email,
            name=user_name,
            id=user_id,
            is_premium=is_premium
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the error
        print(f"Error in Apple authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to authenticate with Apple: {str(e)}"
        )
    
