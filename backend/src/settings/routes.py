"""Settings routes: style guides management."""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, StyleGuide, User, ApiUsage
from ..auth.deps import get_current_user
from ..config import GEMINI_MODEL
from ..utils.cost_calculator import calculate_gemini_cost
from .style_generator import generate_style_guide

router = APIRouter(prefix="/api/settings", tags=["settings"])


class StyleGuideCreate(BaseModel):
    name: str
    description: Optional[str] = None  # What type of text (Facebook post, article, etc.)
    examples: Optional[str] = None


class StyleGuideUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    examples: Optional[str] = None
    guide_content: Optional[str] = None


class StyleGuideResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    examples: Optional[str] = None
    guide_content: Optional[str] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/style-guides", response_model=List[StyleGuideResponse])
def list_style_guides(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all style guides for the current user."""
    guides = db.query(StyleGuide).filter(
        StyleGuide.user_id == user.id
    ).order_by(StyleGuide.is_default.desc(), StyleGuide.name).all()
    return guides


@router.post("/style-guides", response_model=StyleGuideResponse)
def create_style_guide(
    data: StyleGuideCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new style guide."""
    if not data.name or not data.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Navn er påkrævet"
        )

    guide = StyleGuide(
        user_id=user.id,
        name=data.name.strip(),
        description=data.description,
        examples=data.examples
    )
    db.add(guide)
    db.commit()
    db.refresh(guide)
    return guide


@router.get("/style-guides/{id}", response_model=StyleGuideResponse)
def get_style_guide(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific style guide."""
    guide = db.query(StyleGuide).filter(
        StyleGuide.id == id,
        StyleGuide.user_id == user.id
    ).first()

    if not guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stilguide ikke fundet"
        )
    return guide


@router.put("/style-guides/{id}", response_model=StyleGuideResponse)
def update_style_guide(
    id: int,
    data: StyleGuideUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a style guide."""
    guide = db.query(StyleGuide).filter(
        StyleGuide.id == id,
        StyleGuide.user_id == user.id
    ).first()

    if not guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stilguide ikke fundet"
        )

    if data.name is not None:
        guide.name = data.name.strip()
    if data.description is not None:
        guide.description = data.description
    if data.examples is not None:
        guide.examples = data.examples
    if data.guide_content is not None:
        guide.guide_content = data.guide_content

    db.commit()
    db.refresh(guide)
    return guide


@router.delete("/style-guides/{id}")
def delete_style_guide(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a style guide."""
    guide = db.query(StyleGuide).filter(
        StyleGuide.id == id,
        StyleGuide.user_id == user.id
    ).first()

    if not guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stilguide ikke fundet"
        )

    db.delete(guide)
    db.commit()
    return {"message": "Stilguide slettet"}


@router.post("/style-guides/{id}/generate", response_model=StyleGuideResponse)
def regenerate_style_guide(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate/regenerate style guide content from examples using Gemini."""
    guide = db.query(StyleGuide).filter(
        StyleGuide.id == id,
        StyleGuide.user_id == user.id
    ).first()

    if not guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stilguide ikke fundet"
        )

    if not guide.examples or not guide.examples.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingen teksteksempler at generere fra"
        )

    result = generate_style_guide(guide.examples, guide.description)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error
        )

    guide.guide_content = result.content

    # Log API usage for Gemini
    if result.input_tokens > 0 or result.output_tokens > 0:
        usage = ApiUsage(
            user_id=user.id,
            provider="gemini",
            model=GEMINI_MODEL,
            operation="generate_style",
            api_tier=result.api_tier,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=calculate_gemini_cost(result.input_tokens, result.output_tokens, GEMINI_MODEL),
            style_guide_id=guide.id
        )
        db.add(usage)

    db.commit()
    db.refresh(guide)
    return guide


@router.put("/style-guides/{id}/default", response_model=StyleGuideResponse)
def set_default_style_guide(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set a style guide as the default for this user."""
    guide = db.query(StyleGuide).filter(
        StyleGuide.id == id,
        StyleGuide.user_id == user.id
    ).first()

    if not guide:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stilguide ikke fundet"
        )

    # Remove default from all other guides
    db.query(StyleGuide).filter(
        StyleGuide.user_id == user.id,
        StyleGuide.id != id
    ).update({"is_default": False})

    # Set this one as default
    guide.is_default = True
    db.commit()
    db.refresh(guide)
    return guide
