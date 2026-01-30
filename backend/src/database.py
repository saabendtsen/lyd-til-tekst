"""Database setup and models using SQLAlchemy."""
from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import sessionmaker, relationship, declarative_base

from .config import DATABASE_URL, DATABASE_PATH

# Ensure data directory exists
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """User account."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)  # Optional, for password reset
    created_at = Column(DateTime, default=datetime.utcnow)

    transcriptions = relationship("Transcription", back_populates="user")
    style_guides = relationship("StyleGuide", back_populates="user")
    api_usage = relationship("ApiUsage", back_populates="user")


class Transcription(Base):
    """Audio transcription with optional AI processing."""
    __tablename__ = "transcriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Audio metadata
    filename = Column(String(255))
    duration_seconds = Column(Float, default=0.0)
    audio_path = Column(String(500), nullable=True)  # Path to stored audio file

    # Content
    raw_text = Column(Text, nullable=False)  # Whisper output
    instruction = Column(Text, nullable=True)  # User's instruction for processing
    processed_text = Column(Text, nullable=True)  # Gemini output

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="transcriptions")


class StyleGuide(Base):
    """User-defined style guide for text processing."""
    __tablename__ = "style_guides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)  # "Formel email", "Mødenotat"
    description = Column(Text, nullable=True)  # What type of text (Facebook post, article, etc.)
    examples = Column(Text, nullable=True)  # User's example texts
    guide_content = Column(Text, nullable=True)  # Gemini-generated style guide
    is_default = Column(Boolean, default=False)  # Default guide for this user
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="style_guides")


class ImageGeneration(Base):
    """Track image generation sessions for multi-turn editing."""
    __tablename__ = "image_generations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    transcription_id = Column(Integer, ForeignKey("transcriptions.id"), nullable=True)

    # Prompt and result
    prompt = Column(Text, nullable=False)  # User's image prompt
    image_path = Column(String(500), nullable=True)  # Path to generated image
    image_data = Column(Text, nullable=True)  # Base64 encoded (for small images)

    # Multi-turn state
    thought_signature = Column(Text, nullable=True)  # For conversational editing
    turn_number = Column(Integer, default=1)  # Which iteration
    parent_id = Column(Integer, ForeignKey("image_generations.id"), nullable=True)  # Previous turn

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Note: User relationship removed - table preserved for historical data


class ApiUsage(Base):
    """Track API usage and costs per user."""
    __tablename__ = "api_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # API info
    provider = Column(String(50), nullable=False)  # 'openai', 'gemini'
    model = Column(String(100), nullable=False)    # 'whisper-1', 'gemini-3-flash-preview'
    operation = Column(String(50), nullable=False) # 'transcribe', 'process', 'generate_style'
    api_tier = Column(String(20), nullable=True)   # 'free', 'paid'

    # Usage metrics
    audio_seconds = Column(Float, nullable=True)      # For Whisper
    input_tokens = Column(Integer, nullable=True)     # For Gemini
    output_tokens = Column(Integer, nullable=True)    # For Gemini
    images_generated = Column(Integer, nullable=True) # For image generation
    image_resolution = Column(String(10), nullable=True)  # '1k', '2k', '4k'

    # Cost (stored in USD)
    cost_usd = Column(Float, nullable=False, default=0.0)

    # References
    transcription_id = Column(Integer, ForeignKey("transcriptions.id"), nullable=True)
    style_guide_id = Column(Integer, ForeignKey("style_guides.id"), nullable=True)
    image_generation_id = Column(Integer, ForeignKey("image_generations.id"), nullable=True)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="api_usage")


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
