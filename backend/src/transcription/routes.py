"""Transcription routes: upload, list, process."""
import tempfile
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, Transcription, User
from ..auth.deps import get_current_user
from ..config import ALLOWED_AUDIO_EXTENSIONS, MAX_UPLOAD_SIZE
from .whisper import transcribe_audio, format_duration
from .gemini import process_text

router = APIRouter(prefix="/api", tags=["transcription"])


class TranscriptionResponse(BaseModel):
    id: int
    filename: Optional[str] = None
    duration_seconds: float
    duration_formatted: str
    raw_text: str
    instruction: Optional[str] = None
    processed_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TranscriptionListResponse(BaseModel):
    transcriptions: List[TranscriptionResponse]
    total: int


class UpdateTranscriptionRequest(BaseModel):
    raw_text: Optional[str] = None


class ProcessRequest(BaseModel):
    instruction: str


def transcription_to_response(t: Transcription) -> TranscriptionResponse:
    """Convert database model to response."""
    return TranscriptionResponse(
        id=t.id,
        filename=t.filename,
        duration_seconds=t.duration_seconds,
        duration_formatted=format_duration(t.duration_seconds),
        raw_text=t.raw_text,
        instruction=t.instruction,
        processed_text=t.processed_text,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.post("/transcribe", response_model=TranscriptionResponse)
async def upload_and_transcribe(
    file: UploadFile = File(...),
    context: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload an audio file and transcribe it with Whisper.

    - **file**: Audio file (m4a, mp3, wav, etc.)
    - **context**: Optional context hint for better transcription
    """
    # Validate file extension
    suffix = Path(file.filename).suffix.lower() if file.filename else ""
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ikke understøttet filtype. Tilladte: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"
        )

    # Check file size
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Filen er for stor. Maksimum: {MAX_UPLOAD_SIZE // (1024*1024)}MB"
        )

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
        temp.write(content)
        temp_path = Path(temp.name)

    try:
        # Transcribe
        result = transcribe_audio(temp_path, prompt=context or "")

        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.error
            )

        # Save to database
        transcription = Transcription(
            user_id=user.id,
            filename=file.filename,
            duration_seconds=result.duration,
            raw_text=result.text
        )
        db.add(transcription)
        db.commit()
        db.refresh(transcription)

        return transcription_to_response(transcription)

    finally:
        # Clean up temp file
        if temp_path.exists():
            temp_path.unlink()


@router.get("/transcriptions", response_model=TranscriptionListResponse)
def list_transcriptions(
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's transcriptions, newest first."""
    query = db.query(Transcription).filter(Transcription.user_id == user.id)
    total = query.count()
    transcriptions = query.order_by(Transcription.created_at.desc()).offset(skip).limit(limit).all()

    return TranscriptionListResponse(
        transcriptions=[transcription_to_response(t) for t in transcriptions],
        total=total
    )


@router.get("/transcriptions/{id}", response_model=TranscriptionResponse)
def get_transcription(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific transcription."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    return transcription_to_response(transcription)


@router.put("/transcriptions/{id}", response_model=TranscriptionResponse)
def update_transcription(
    id: int,
    request: UpdateTranscriptionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a transcription's raw text."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    if request.raw_text is not None:
        transcription.raw_text = request.raw_text

    db.commit()
    db.refresh(transcription)

    return transcription_to_response(transcription)


@router.post("/transcriptions/{id}/process", response_model=TranscriptionResponse)
def process_transcription(
    id: int,
    request: ProcessRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process a transcription with Gemini using the given instruction."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    # Process with Gemini
    result = process_text(transcription.raw_text, request.instruction)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error
        )

    # Update transcription
    transcription.instruction = request.instruction
    transcription.processed_text = result.text
    db.commit()
    db.refresh(transcription)

    return transcription_to_response(transcription)


@router.delete("/transcriptions/{id}")
def delete_transcription(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a transcription."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    db.delete(transcription)
    db.commit()

    return {"message": "Transskription slettet"}
