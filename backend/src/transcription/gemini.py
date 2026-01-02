"""Text processing using Gemini API (free tier primary, paid fallback)."""
import json
import re
from dataclasses import dataclass
from typing import Optional

from ..config import GEMINI_API_KEY_FREE, GEMINI_API_KEY_PAID, GEMINI_MODEL


@dataclass
class ProcessingResult:
    """Result from processing text with Gemini."""
    success: bool
    text: Optional[str] = None
    error: Optional[str] = None


def process_text(raw_text: str, instruction: str) -> ProcessingResult:
    """
    Process transcribed text with Gemini based on user instruction.

    Args:
        raw_text: The raw transcription from Whisper
        instruction: User's instruction for how to process the text

    Returns:
        ProcessingResult with the processed text or error.
    """
    if not instruction.strip():
        return ProcessingResult(
            success=False,
            error="Ingen instruks angivet"
        )

    prompt = f"""Du er en hjælpsom assistent der bearbejder transskriberet tekst.

TRANSSKRIPTION:
{raw_text}

BRUGERENS INSTRUKS:
{instruction}

---

Udfør brugerens instruks på transskriptionen. Skriv kun det bearbejdede resultat, ingen indledning eller forklaring."""

    # Try free tier first
    if GEMINI_API_KEY_FREE:
        result = _process_with_gemini(prompt, GEMINI_API_KEY_FREE)
        if result.success:
            return result
        print(f"  Gemini free tier fejlede: {result.error}, prøver paid tier...")

    # Fallback to paid tier
    if GEMINI_API_KEY_PAID:
        result = _process_with_gemini(prompt, GEMINI_API_KEY_PAID)
        if result.success:
            return result
        print(f"  Gemini paid tier fejlede: {result.error}")

    return ProcessingResult(
        success=False,
        error="Ingen Gemini API keys konfigureret eller begge fejlede"
    )


def _process_with_gemini(prompt: str, api_key: str) -> ProcessingResult:
    """Process using Google Gemini API."""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8000,
            )
        )

        # Check if response was blocked by safety filters
        try:
            response_text = response.text.strip()
        except ValueError as e:
            return ProcessingResult(
                success=False,
                error=f"Blokeret af sikkerhedsfiltre: {str(e)}"
            )

        return ProcessingResult(
            success=True,
            text=response_text
        )

    except Exception as e:
        return ProcessingResult(
            success=False,
            error=f"Gemini API fejl: {str(e)}"
        )
