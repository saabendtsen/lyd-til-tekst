"""Auth dependencies for FastAPI routes."""
from typing import Optional
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db, User
from .utils import decode_token


def _validate_token_and_get_user(
    token: Optional[str],
    db: Session,
    raise_on_error: bool = True
) -> Optional[User]:
    """
    Validate JWT token and return the user.

    Args:
        token: JWT token from cookie
        db: Database session
        raise_on_error: If True, raise HTTPException on validation failure.
                       If False, return None on failure.

    Returns:
        User if valid, None if invalid and raise_on_error is False

    Raises:
        HTTPException if validation fails and raise_on_error is True
    """
    if not token:
        if raise_on_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ikke logget ind"
            )
        return None

    payload = decode_token(token)
    if not payload:
        if raise_on_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ugyldig eller udløbet session"
            )
        return None

    # Check if 'sub' exists in payload before database lookup
    sub = payload.get("sub")
    if sub is None or sub == "":
        if raise_on_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ugyldig bruger-ID i token"
            )
        return None

    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        if raise_on_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ugyldig bruger-ID i token"
            )
        return None

    user = db.get(User, user_id)

    if not user:
        if raise_on_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Bruger ikke fundet"
            )
        return None

    return user


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db)
) -> User:
    """Get the current authenticated user from JWT cookie."""
    user = _validate_token_and_get_user(access_token, db, raise_on_error=True)
    # Type narrowing: we know user is not None because raise_on_error=True
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bruger ikke fundet")
    return user


def get_optional_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user if logged in, None otherwise."""
    return _validate_token_and_get_user(access_token, db, raise_on_error=False)
