"""Auth dependencies for FastAPI routes."""
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db, User
from .utils import decode_token


def get_token_from_cookie(request: Request) -> Optional[str]:
    """Extract JWT token from httpOnly cookie."""
    return request.cookies.get("access_token")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user from JWT cookie."""
    token = get_token_from_cookie(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ikke logget ind"
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ugyldig eller udløbet session"
        )

    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bruger ikke fundet"
        )

    return user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if logged in, None otherwise."""
    token = get_token_from_cookie(request)
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    user_id = int(payload.get("sub", 0))
    return db.query(User).filter(User.id == user_id).first()
