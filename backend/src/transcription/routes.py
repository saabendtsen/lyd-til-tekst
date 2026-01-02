"""Transcription routes: upload, list, process."""
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, Transcription, User, StyleGuide, ApiUsage
from ..auth.deps import get_current_user
from ..config import ALLOWED_AUDIO_EXTENSIONS, MAX_UPLOAD_SIZE, WHISPER_MODEL, GEMINI_MODEL
from ..utils.cost_calculator import calculate_whisper_cost, calculate_gemini_cost
from .whisper import transcribe_audio, format_duration
from .gemini import process_text

router = APIRouter(prefix="/api", tags=["transcription"])

# Audio storage directory
AUDIO_DIR = Path(__file__).parent.parent.parent / "data" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


class TranscriptionResponse(BaseModel):
    id: int
    filename: Optional[str] = None
    duration_seconds: float
    duration_formatted: str
    raw_text: str
    instruction: Optional[str] = None
    processed_text: Optional[str] = None
    has_audio: bool = False
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
    style_guide_id: Optional[int] = None


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
        has_audio=bool(t.audio_path and Path(t.audio_path).exists()),
        created_at=t.created_at,
        updated_at=t.updated_at
    )


def get_audio_path(user_id: int, transcription_id: int, suffix: str = ".m4a") -> Path:
    """Get the path for storing a user's audio file."""
    user_dir = AUDIO_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir / f"{transcription_id}{suffix}"


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

        # Save to database first to get ID
        transcription = Transcription(
            user_id=user.id,
            filename=file.filename,
            duration_seconds=result.duration,
            raw_text=result.text
        )
        db.add(transcription)
        db.commit()
        db.refresh(transcription)

        # Save audio file permanently
        audio_path = get_audio_path(user.id, transcription.id, suffix)
        shutil.copy2(temp_path, audio_path)
        transcription.audio_path = str(audio_path)

        # Log API usage for Whisper
        usage = ApiUsage(
            user_id=user.id,
            provider="openai",
            model=WHISPER_MODEL,
            operation="transcribe",
            api_tier="paid",
            audio_seconds=result.duration,
            cost_usd=calculate_whisper_cost(result.duration, WHISPER_MODEL),
            transcription_id=transcription.id
        )
        db.add(usage)
        db.commit()

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

    # Fetch style guide if specified
    style_guide_content = None
    if request.style_guide_id:
        style_guide = db.query(StyleGuide).filter(
            StyleGuide.id == request.style_guide_id,
            StyleGuide.user_id == user.id
        ).first()
        if style_guide and style_guide.guide_content:
            style_guide_content = style_guide.guide_content

    # Process with Gemini
    result = process_text(transcription.raw_text, request.instruction, style_guide_content)

    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error
        )

    # Update transcription
    transcription.instruction = request.instruction
    transcription.processed_text = result.text

    # Log API usage for Gemini
    if result.input_tokens > 0 or result.output_tokens > 0:
        usage = ApiUsage(
            user_id=user.id,
            provider="gemini",
            model=GEMINI_MODEL,
            operation="process",
            api_tier=result.api_tier,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=calculate_gemini_cost(result.input_tokens, result.output_tokens, GEMINI_MODEL),
            transcription_id=transcription.id
        )
        db.add(usage)

    db.commit()
    db.refresh(transcription)

    return transcription_to_response(transcription)


@router.delete("/transcriptions/{id}")
def delete_transcription(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a transcription and its audio file."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    # Delete audio file if exists
    if transcription.audio_path:
        audio_path = Path(transcription.audio_path)
        if audio_path.exists():
            audio_path.unlink()

    db.delete(transcription)
    db.commit()

    return {"message": "Transskription slettet"}


@router.get("/transcriptions/{id}/audio")
def get_audio(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stream the audio file for a transcription."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    if not transcription.audio_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingen lydfil tilknyttet"
        )

    audio_path = Path(transcription.audio_path)
    if not audio_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lydfil ikke fundet"
        )

    # Determine media type from extension
    suffix = audio_path.suffix.lower()
    media_types = {
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(suffix, "audio/mpeg")

    return FileResponse(
        audio_path,
        media_type=media_type,
        filename=transcription.filename or f"audio{suffix}"
    )


@router.delete("/transcriptions/{id}/audio")
def delete_audio(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete only the audio file, keep the transcription."""
    transcription = db.query(Transcription).filter(
        Transcription.id == id,
        Transcription.user_id == user.id
    ).first()

    if not transcription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transskription ikke fundet"
        )

    if not transcription.audio_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ingen lydfil tilknyttet"
        )

    # Delete the audio file
    audio_path = Path(transcription.audio_path)
    if audio_path.exists():
        audio_path.unlink()

    # Clear the audio_path in database
    transcription.audio_path = None
    db.commit()

    return {"message": "Lydfil slettet"}
