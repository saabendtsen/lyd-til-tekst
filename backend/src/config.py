"""Configuration loaded from environment variables."""
import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Load central ~/.env first, then local .env (can override)
load_dotenv(Path.home() / ".env")
load_dotenv()

# Database
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", Path(__file__).parent.parent / "data" / "lyd-til-tekst.db"))
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Auth
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

# OpenAI (Whisper)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WHISPER_MODEL = "whisper-1"
WHISPER_LANGUAGE = "da"

# Gemini (dual-tier)
GEMINI_API_KEY_FREE = os.getenv("GEMINI_API_KEY_FREE") or os.getenv("GEMINI_API_KEY")
GEMINI_API_KEY_PAID = os.getenv("GEMINI_API_KEY_PAID") or os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Server
HOST = os.getenv("LYD_TIL_TEKST_HOST", "127.0.0.1")
PORT = int(os.getenv("LYD_TIL_TEKST_PORT", "8090"))

# File upload
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB for long recordings
ALLOWED_AUDIO_EXTENSIONS = {".m4a", ".mp3", ".wav", ".ogg", ".webm", ".mp4", ".aac", ".flac"}
