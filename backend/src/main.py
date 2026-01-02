"""FastAPI application for Lyd til Tekst."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .auth.routes import router as auth_router
from .transcription.routes import router as transcription_router

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="Lyd til Tekst",
    description="Diktat-værktøj: Upload lydfil → Whisper transskription → Gemini bearbejdning",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4321",  # Astro dev server
        "http://localhost:3000",
        "https://wibholmsolutions.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(transcription_router)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "lyd-til-tekst"}


if __name__ == "__main__":
    import uvicorn
    from .config import HOST, PORT

    uvicorn.run(app, host=HOST, port=PORT)
