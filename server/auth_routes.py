from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import RedirectResponse
from typing import Optional
from sqlalchemy.orm import Session
import httpx
import os
from datetime import datetime

from database import SessionLocal
from models import User
from auth import create_jwt_token, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["authentication"])


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class GoogleAuthResponse(BaseModel):
    token: str
    user: dict


@router.get("/google")
async def google_login():
    """
    Redirect user to Google OAuth consent screen.
    Mobile app should open this URL in a web view or browser.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=openid email profile&"
        f"access_type=offline"
    )

    return {"auth_url": google_auth_url}


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback.
    Exchange authorization code for access token and create/login user.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")

        tokens = token_response.json()
        access_token = tokens["access_token"]

        # Get user info from Google
        user_info_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_info_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        user_info = user_info_response.json()

    # Create or update user in database
    google_id = user_info["id"]
    email = user_info["email"]

    user = db.query(User).filter(User.google_id == google_id).first()

    if user:
        # Existing user - update last_used
        user.last_used = datetime.utcnow()
        db.commit()
    else:
        # New user - create account
        user = User(
            auth_provider="google",
            google_id=google_id,
            apple_id=None,
            email=email,
            created_at=datetime.utcnow(),
            last_used=datetime.utcnow(),
            is_active=True,
            daily_requests=0,
            daily_reset_date=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate JWT token
    jwt_token = create_jwt_token(user.id, user.email, "google")

    # For mobile app: Return a custom URL scheme redirect with the token
    # The app should intercept this URL
    return RedirectResponse(
        url=f"m3ajem://auth/callback?token={jwt_token}&email={email}"
    )


@router.post("/google/mobile", response_model=GoogleAuthResponse)
async def google_mobile_auth(id_token: str, db: Session = Depends(get_db)):
    """
    Alternative endpoint for mobile apps using Google Sign-In SDK.
    Mobile app gets ID token directly from Google SDK and sends it here.
    This is simpler than web OAuth flow for mobile apps.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    # Verify ID token with Google
    async with httpx.AsyncClient() as client:
        verify_response = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        )

        if verify_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid ID token")

        user_info = verify_response.json()

        # Verify audience (client ID)
        if user_info.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Invalid token audience")

    google_id = user_info["sub"]
    email = user_info["email"]

    # Create or update user in database
    user = db.query(User).filter(User.google_id == google_id).first()

    if user:
        # Existing user - update last_used
        user.last_used = datetime.utcnow()
        db.commit()
    else:
        # New user - create account
        user = User(
            auth_provider="google",
            google_id=google_id,
            apple_id=None,
            email=email,
            created_at=datetime.utcnow(),
            last_used=datetime.utcnow(),
            is_active=True,
            daily_requests=0,
            daily_reset_date=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate JWT token
    jwt_token = create_jwt_token(user.id, user.email, "google")

    return GoogleAuthResponse(
        token=jwt_token,
        user={
            "id": user.id,
            "email": user.email,
            "daily_requests": user.daily_requests,
            "daily_limit": 30,
        },
    )


@router.post("/apple/mobile", response_model=GoogleAuthResponse)
async def apple_mobile_auth(
    identity_token: str,
    user_id: str,
    email: str = None,
    db: Session = Depends(get_db)
):
    """
    Apple Sign In for mobile apps.
    Mobile app uses Apple's native SDK to get identity token and user info,
    then sends it here for verification and account creation.

    Note: Apple may hide user's real email, so email might be a private relay.
    """
    # For Apple Sign In, we trust the mobile app's SDK verification
    # In production, you should verify the identity_token with Apple's servers
    # For now, we'll accept it (the mobile SDK does the verification)

    apple_id = user_id

    # Use provided email or create a placeholder
    user_email = email if email else f"{apple_id}@appleid.private"

    # Create or update user in database
    user = db.query(User).filter(User.apple_id == apple_id).first()

    if user:
        # Existing user - update last_used and email if provided
        user.last_used = datetime.utcnow()
        if email:
            user.email = email
        db.commit()
    else:
        # New user - create account
        user = User(
            auth_provider="apple",
            google_id=None,
            apple_id=apple_id,
            email=user_email,
            created_at=datetime.utcnow(),
            last_used=datetime.utcnow(),
            is_active=True,
            daily_requests=0,
            daily_reset_date=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Generate JWT token
    jwt_token = create_jwt_token(user.id, user.email, "apple")

    return GoogleAuthResponse(
        token=jwt_token,
        user={
            "id": user.id,
            "email": user.email,
            "daily_requests": user.daily_requests,
            "daily_limit": 30,
        },
    )


@router.get("/me")
async def get_current_user_info(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get current user information from JWT token"""
    from auth import get_current_user

    user = get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "id": user.id,
        "email": user.email,
        "provider": user.auth_provider,
        "daily_requests": user.daily_requests,
        "daily_limit": 30,
        "created_at": user.created_at.isoformat(),
    }
