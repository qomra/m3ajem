import os
import sys
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, Header
from sqlalchemy.orm import Session
from models import User

# JWT Configuration - REQUIRED on startup
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    print("ERROR: JWT_SECRET environment variable is required!")
    print("Please set JWT_SECRET to a secure random string (at least 32 characters)")
    sys.exit(1)

if len(JWT_SECRET) < 32:
    print("WARNING: JWT_SECRET should be at least 32 characters for security")

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7  # Reduced from 30 for better security

# Rate Limit Configuration
DAILY_REQUEST_LIMIT = int(os.getenv("DAILY_REQUEST_LIMIT", "30"))

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")


def create_jwt_token(user_id: int, email: str, provider: str) -> str:
    """Create a JWT token for authenticated user"""
    payload = {
        "user_id": user_id,
        "email": email,
        "provider": provider,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(authorization: Optional[str] = Header(None), db: Session = None) -> Optional[User]:
    """
    Extract and validate user from JWT token in Authorization header.
    Returns None if no token provided (for optional auth).
    Raises HTTPException if token is invalid.
    """
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.replace("Bearer ", "")
    payload = decode_jwt_token(token)

    # Get user from database
    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


def check_rate_limit(user: User, db: Session) -> bool:
    """
    Check if user has exceeded daily rate limit.
    Returns True if within limit, False if exceeded.
    Resets counter if it's a new day.
    """
    # Check if we need to reset the daily counter
    now = datetime.utcnow()
    if user.daily_reset_date.date() < now.date():
        # New day, reset counter
        user.daily_requests = 0
        user.daily_reset_date = now

    # Check if limit exceeded
    if user.daily_requests >= DAILY_REQUEST_LIMIT:
        return False

    # Increment counter
    user.daily_requests += 1
    user.last_used = now
    db.commit()

    return True
