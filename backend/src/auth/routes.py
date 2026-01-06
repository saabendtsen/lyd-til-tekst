"""Auth routes: register, login, logout."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..database import get_db, User
from .utils import hash_password, verify_password, create_access_token
from .deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=12, max_length=72)
    email: Optional[EmailStr] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("/register", response_model=UserResponse)
def register(
    request: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Register a new user."""
    # Check if username exists
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brugernavnet er allerede taget"
        )

    # Check if email already exists
    if request.email:
        existing_email = db.query(User).filter(User.email == request.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email er allerede i brug"
            )

    # Create user
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        email=request.email
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Brugernavn eller email er allerede i brug"
        )

    # Set auth cookie
    token = create_access_token(user.id, user.username)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,  # HTTPS only
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )

    return user


@router.post("/login", response_model=UserResponse)
def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    """Login and get auth cookie."""
    user = db.query(User).filter(User.username == request.username).first()

    # Always verify password to prevent timing attacks for user enumeration
    # Use a dummy hash if user doesn't exist to maintain constant time
    dummy_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4m9JHXQa7x4.0Z7q"
    password_hash = user.password_hash if user else dummy_hash
    password_valid = verify_password(request.password, password_hash)

    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert brugernavn eller password"
        )

    # Set auth cookie
    token = create_access_token(user.id, user.username)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30
    )

    return user


@router.post("/logout")
def logout(response: Response):
    """Logout by clearing the auth cookie."""
    response.delete_cookie(key="access_token", httponly=True, secure=True, samesite="lax")
    return {"message": "Logget ud"}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    """Get the current logged-in user."""
    return user
