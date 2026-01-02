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
    # Token usage for cost tracking
    input_tokens: int = 0
    output_tokens: int = 0
    api_tier: Optional[str] = None  # 'free' or 'paid'


SYSTEM_PROMPT = """Du hjælper små erhvervsdrivende med at bearbejde dikterede tekster.

Kontekst:
- Teksten kommer fra Whisper transskription og kan have småfejl
- Brugeren dikterer ofte breve, notater, mødereferater, emails
- Sprog er dansk

Retningslinjer:
- Ret åbenlyse tale-til-tekst fejl (fx "kommune" vs "komme", "der" vs "de")
- Bevar brugerens tone og stil
- Formatér overskueligt med afsnit hvor det giver mening
- Skriv KUN det bearbejdede resultat, ingen indledning eller forklaring"""


def process_text(raw_text: str, instruction: str, style_guide: Optional[str] = None) -> ProcessingResult:
    """
    Process transcribed text with Gemini based on user instruction.

    Args:
        raw_text: The raw transcription from Whisper
        instruction: User's instruction for how to process the text
        style_guide: Optional user-defined style guide to apply

    Returns:
        ProcessingResult with the processed text or error.
    """
    if not instruction.strip():
        return ProcessingResult(
            success=False,
            error="Ingen instruks angivet"
        )

    prompt = f"""TRANSSKRIPTION:
{raw_text}

BRUGERENS INSTRUKS:
{instruction}"""

    # Build system prompt with optional style guide
    system_prompt = SYSTEM_PROMPT
    if style_guide:
        system_prompt = f"{SYSTEM_PROMPT}\n\nBRUGERENS STILGUIDE:\n{style_guide}"

    # Try free tier first
    if GEMINI_API_KEY_FREE:
        result = _process_with_gemini(prompt, GEMINI_API_KEY_FREE, system_prompt, tier="free")
        if result.success:
            return result
        print(f"  Gemini free tier fejlede: {result.error}, prøver paid tier...")

    # Fallback to paid tier
    if GEMINI_API_KEY_PAID:
        result = _process_with_gemini(prompt, GEMINI_API_KEY_PAID, system_prompt, tier="paid")
        if result.success:
            return result
        print(f"  Gemini paid tier fejlede: {result.error}")

    return ProcessingResult(
        success=False,
        error="Ingen Gemini API keys konfigureret eller begge fejlede"
    )


def _process_with_gemini(prompt: str, api_key: str, system_prompt: str, tier: str = "paid") -> ProcessingResult:
    """Process using Google Gemini API."""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3,
                max_output_tokens=8000,
            )
        )

        # Extract token counts from usage metadata
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) or 0
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) or 0

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
            text=response_text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            api_tier=tier
        )

    except Exception as e:
        return ProcessingResult(
            success=False,
            error=f"Gemini API fejl: {str(e)}"
        )
