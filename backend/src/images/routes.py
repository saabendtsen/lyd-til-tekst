"""Image generation routes with multi-turn support."""
import base64
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, ImageGeneration, Transcription, User, ApiUsage
from ..auth.deps import get_current_user
from ..utils.cost_calculator import calculate_image_generation_cost
from .generator import generate_image, ConversationTurn, IMAGE_MODEL

router = APIRouter(prefix="/api/images", tags=["images"])


class GenerateImageRequest(BaseModel):
    prompt: str
    session_id: Optional[int] = None  # For multi-turn: previous generation ID
    transcription_id: Optional[int] = None  # Link to transcription
    aspect_ratio: str = "1:1"  # 1:1, 16:9, 9:16, 4:3, 3:4
    resolution: str = "2k"  # 1k, 2k, 4k


class ImageGenerationResponse(BaseModel):
    id: int
    prompt: str
    image_url: str  # Endpoint to fetch image
    text_response: Optional[str] = None
    turn_number: int
    parent_id: Optional[int] = None
    transcription_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImageHistoryResponse(BaseModel):
    generations: List[ImageGenerationResponse]
    total: int


def generation_to_response(gen: ImageGeneration) -> ImageGenerationResponse:
    """Convert database model to response."""
    return ImageGenerationResponse(
        id=gen.id,
        prompt=gen.prompt,
        image_url=f"/api/images/{gen.id}/data",
        text_response=None,  # Could store this if needed
        turn_number=gen.turn_number,
        parent_id=gen.parent_id,
        transcription_id=gen.transcription_id,
        created_at=gen.created_at
    )


def build_conversation_history(
    db: Session,
    generation_id: int,
    user_id: int
) -> List[ConversationTurn]:
    """Build conversation history from previous generations."""
    history = []

    # Walk back through parent chain
    current_id = generation_id
    generations = []

    while current_id:
        gen = db.query(ImageGeneration).filter(
            ImageGeneration.id == current_id,
            ImageGeneration.user_id == user_id
        ).first()

        if not gen:
            break

        generations.append(gen)
        current_id = gen.parent_id

    # Reverse to get chronological order
    generations.reverse()

    # Build history
    for gen in generations:
        # User turn (prompt)
        history.append(ConversationTurn(
            role="user",
            text=gen.prompt
        ))

        # Model turn (generated image)
        if gen.image_data:
            history.append(ConversationTurn(
                role="model",
                image_base64=gen.image_data,
                image_mime_type="image/png",
                thought_signature=gen.thought_signature  # Required for multi-turn
            ))

    return history


@router.post("/generate", response_model=ImageGenerationResponse)
def generate_image_endpoint(
    request: GenerateImageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate an image from a text prompt.

    For multi-turn editing, pass session_id with the previous generation's ID.
    The model will use the conversation history to understand context.
    """
    # Validate transcription_id belongs to user if provided
    if request.transcription_id:
        transcription = db.query(Transcription).filter(
            Transcription.id == request.transcription_id,
            Transcription.user_id == user.id
        ).first()
        if not transcription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transskription ikke fundet"
            )

    # Build conversation history if continuing a session
    conversation_history = None
    parent_id = None
    turn_number = 1

    if request.session_id:
        parent = db.query(ImageGeneration).filter(
            ImageGeneration.id == request.session_id,
            ImageGeneration.user_id == user.id
        ).first()

        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session ikke fundet"
            )

        conversation_history = build_conversation_history(
            db, request.session_id, user.id
        )
        parent_id = request.session_id
        turn_number = parent.turn_number + 1

    # Generate image
    result = generate_image(
        prompt=request.prompt,
        conversation_history=conversation_history,
        aspect_ratio=request.aspect_ratio,
        resolution=request.resolution
    )

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error
        )

    # Save to database
    generation = ImageGeneration(
        user_id=user.id,
        prompt=request.prompt,
        image_data=result.image_base64,
        thought_signature=result.thought_signature,  # Required for multi-turn editing
        turn_number=turn_number,
        parent_id=parent_id,
        transcription_id=request.transcription_id
    )
    db.add(generation)
    db.flush()  # Get ID without committing

    # Log API usage
    cost = calculate_image_generation_cost(
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        images_generated=result.images_generated,
        resolution=request.resolution,
        model=IMAGE_MODEL
    )

    usage = ApiUsage(
        user_id=user.id,
        provider="gemini",
        model=IMAGE_MODEL,
        operation="generate_image",
        api_tier=result.api_tier,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        images_generated=result.images_generated,
        image_resolution=request.resolution,
        cost_usd=cost,
        image_generation_id=generation.id
    )
    db.add(usage)
    db.commit()
    db.refresh(generation)

    return generation_to_response(generation)


@router.get("/{id}/data")
def get_image_data(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the raw image data for a generation."""
    generation = db.query(ImageGeneration).filter(
        ImageGeneration.id == id,
        ImageGeneration.user_id == user.id
    ).first()

    if not generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billede ikke fundet"
        )

    if not generation.image_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingen billeddata"
        )

    try:
        image_bytes = base64.b64decode(generation.image_data)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Korrupt billeddata"
        )

    return Response(
        content=image_bytes,
        media_type="image/png"
    )


@router.get("/{id}", response_model=ImageGenerationResponse)
def get_generation(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metadata for a specific image generation."""
    generation = db.query(ImageGeneration).filter(
        ImageGeneration.id == id,
        ImageGeneration.user_id == user.id
    ).first()

    if not generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billede ikke fundet"
        )

    return generation_to_response(generation)


@router.get("/transcription/{transcription_id}", response_model=List[ImageGenerationResponse])
def get_images_for_transcription(
    transcription_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all images generated for a specific transcription."""
    generations = db.query(ImageGeneration).filter(
        ImageGeneration.user_id == user.id,
        ImageGeneration.transcription_id == transcription_id
    ).order_by(ImageGeneration.created_at.desc()).all()

    return [generation_to_response(g) for g in generations]


@router.get("/", response_model=ImageHistoryResponse)
def list_generations(
    skip: int = 0,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's image generations, newest first."""
    query = db.query(ImageGeneration).filter(ImageGeneration.user_id == user.id)
    total = query.count()
    generations = query.order_by(
        ImageGeneration.created_at.desc()
    ).offset(skip).limit(limit).all()

    return ImageHistoryResponse(
        generations=[generation_to_response(g) for g in generations],
        total=total
    )


@router.delete("/{id}")
def delete_generation(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an image generation."""
    generation = db.query(ImageGeneration).filter(
        ImageGeneration.id == id,
        ImageGeneration.user_id == user.id
    ).first()

    if not generation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Billede ikke fundet"
        )

    db.delete(generation)
    db.commit()

    return {"message": "Billede slettet"}
