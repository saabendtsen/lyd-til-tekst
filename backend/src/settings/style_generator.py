"""Generate style guides from text examples using Gemini."""
import logging
from dataclasses import dataclass
from typing import Optional

from google import genai
from google.genai import types

from ..config import GEMINI_API_KEY_FREE, GEMINI_API_KEY_PAID, GEMINI_MODEL

logger = logging.getLogger(__name__)


@dataclass
class GenerationResult:
    """Result from generating a style guide."""
    success: bool
    content: Optional[str] = None
    error: Optional[str] = None
    # Token usage for cost tracking
    input_tokens: int = 0
    output_tokens: int = 0
    api_tier: Optional[str] = None  # 'free' or 'paid'


STYLE_GUIDE_PROMPT = """Analysér følgende teksteksempler og lav en præcis stilguide.
{description_section}
EKSEMPLER:
{examples}

Lav en stilguide der beskriver:
- Tone (formel/uformel, professionel/venlig)
- Sætningsstruktur (korte/lange sætninger, aktiv/passiv form)
- Ordvalg (fagtermer, hverdagssprog, specielle udtryk)
- Formatering (afsnit, punktopstilling, overskrifter)
- Hilsener og afslutninger (hvis relevant)
- Platform-specifikke konventioner (hvis relevant)
- Andre mønstre du bemærker

Skriv stilguiden som klare, konkrete instruktioner der kan bruges til at skrive i samme stil.
Output kun stilguiden, ingen indledning eller forklaring."""


def generate_style_guide(examples: str, description: Optional[str] = None) -> GenerationResult:
    """
    Generate a style guide from text examples using Gemini.

    Args:
        examples: User-provided text examples
        description: Optional description of text type (e.g., "Facebook opslag", "Artikel")

    Returns:
        GenerationResult with the generated style guide or error.
    """
    if not examples or not examples.strip():
        return GenerationResult(
            success=False,
            error="Ingen teksteksempler angivet"
        )

    # Build description section if provided
    description_section = ""
    if description and description.strip():
        description_section = f"\nTEKSTTYPE/FORMÅL:\n{description.strip()}\n"

    # Use replace instead of format to avoid KeyError on curly braces in examples
    prompt = STYLE_GUIDE_PROMPT.replace(
        "{description_section}", description_section
    ).replace("{examples}", examples)

    # Try free tier first
    if GEMINI_API_KEY_FREE:
        result = _generate_with_gemini(prompt, GEMINI_API_KEY_FREE, tier="free")
        if result.success:
            return result

    # Fallback to paid tier
    if GEMINI_API_KEY_PAID:
        result = _generate_with_gemini(prompt, GEMINI_API_KEY_PAID, tier="paid")
        if result.success:
            return result
        logger.error("Style guide generation failed on paid tier: %s", result.error)

    return GenerationResult(
        success=False,
        error="Kunne ikke generere stilguide - ingen API keys eller begge fejlede"
    )


def _generate_with_gemini(prompt: str, api_key: str, tier: str = "paid") -> GenerationResult:
    """Generate using Google Gemini API."""
    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,  # Slightly higher for creative analysis
                max_output_tokens=2000,
            )
        )

        # Extract token counts from usage metadata
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) or 0
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) or 0

        try:
            response_text = response.text.strip()
        except ValueError as e:
            return GenerationResult(
                success=False,
                error=f"Blokeret af sikkerhedsfiltre: {str(e)}"
            )

        return GenerationResult(
            success=True,
            content=response_text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            api_tier=tier
        )

    except Exception as e:
        return GenerationResult(
            success=False,
            error=f"Gemini API fejl: {str(e)}"
        )
