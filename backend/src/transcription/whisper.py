"""Audio transcription using OpenAI Whisper API."""
import subprocess
from pathlib import Path
from dataclasses import dataclass
from typing import Optional

from openai import OpenAI

from ..config import OPENAI_API_KEY, WHISPER_MODEL, WHISPER_LANGUAGE


@dataclass
class TranscriptionResult:
    """Result from transcribing audio."""
    success: bool
    text: Optional[str] = None
    duration: float = 0.0
    error: Optional[str] = None


def get_audio_duration(audio_path: Path) -> float:
    """Get audio duration via ffprobe."""
    result = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(audio_path)],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def convert_to_mp3(audio_path: Path) -> Path:
    """Convert audio to mp3 for reliable API compatibility."""
    mp3_path = audio_path.with_suffix(".converted.mp3")
    result = subprocess.run(
        ['ffmpeg', '-y', '-i', str(audio_path), '-acodec', 'libmp3lame', '-q:a', '2', str(mp3_path)],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr}")
    return mp3_path


def transcribe_audio(audio_path: Path, prompt: str = "") -> TranscriptionResult:
    """
    Transcribe audio file via OpenAI Whisper API.

    Args:
        audio_path: Path to audio file
        prompt: Optional context hint for better transcription

    Returns:
        TranscriptionResult with success=True and text if successful,
        or success=False with error message if failed.
    """
    if not OPENAI_API_KEY:
        return TranscriptionResult(
            success=False,
            error="OPENAI_API_KEY ikke konfigureret"
        )

    mp3_path = None
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        duration = get_audio_duration(audio_path)

        # Convert to mp3 first for reliable API compatibility
        mp3_path = convert_to_mp3(audio_path)

        with open(mp3_path, "rb") as f:
            result = client.audio.transcriptions.create(
                model=WHISPER_MODEL,
                file=f,
                language=WHISPER_LANGUAGE,
                prompt=prompt or "Dansk diktat, tale til tekst."
            )

        return TranscriptionResult(
            success=True,
            text=result.text,
            duration=duration
        )

    except Exception as e:
        return TranscriptionResult(
            success=False,
            error=f"Whisper API fejl: {str(e)}"
        )
    finally:
        # Clean up temp mp3
        if mp3_path and mp3_path.exists():
            mp3_path.unlink()


def format_duration(seconds: float) -> str:
    """Format duration as MM:SS."""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}:{secs:02d}"
