"""Image generation using Gemini 3 Pro Image (Nano Banana Pro).

Supports multi-turn conversational editing where users can iteratively
refine generated images through follow-up prompts.
"""
import base64
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

from ..config import GEMINI_API_KEY_FREE, GEMINI_API_KEY_PAID

IMAGE_MODEL = "gemini-3-pro-image-preview"

# System instruction for image generation
IMAGE_SYSTEM_INSTRUCTION = """You are an image generation assistant. When given text content:
- Be INSPIRED by the themes, mood, and concepts in the text
- Create original visual interpretations - do NOT include literal text or quotes from the input
- Focus on visual metaphors and artistic representation rather than text reproduction"""


@dataclass
class ImageGenerationResult:
    """Result from generating an image."""
    success: bool
    image_base64: Optional[str] = None
    image_mime_type: Optional[str] = None
    text_response: Optional[str] = None
    error: Optional[str] = None
    # For cost tracking
    input_tokens: int = 0
    output_tokens: int = 0
    images_generated: int = 0
    api_tier: Optional[str] = None
    # For multi-turn editing
    thought_signature: Optional[str] = None  # Base64 encoded


@dataclass
class ConversationTurn:
    """A single turn in a multi-turn image conversation."""
    role: str  # 'user' or 'model'
    text: Optional[str] = None
    image_base64: Optional[str] = None
    image_mime_type: Optional[str] = None
    thought_signature: Optional[str] = None  # Base64 encoded, required for model image parts


def generate_image(
    prompt: str,
    conversation_history: Optional[List[ConversationTurn]] = None,
    aspect_ratio: str = "1:1",
    resolution: str = "2k"
) -> ImageGenerationResult:
    """
    Generate an image from a text prompt, with optional multi-turn history.

    Args:
        prompt: Text description of desired image
        conversation_history: Previous turns for multi-turn editing
        aspect_ratio: Image aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
        resolution: Image resolution (1k, 2k, 4k)

    Returns:
        ImageGenerationResult with base64 image data or error.
    """
    # Try free tier first
    if GEMINI_API_KEY_FREE:
        result = _generate_with_gemini(
            prompt, GEMINI_API_KEY_FREE, conversation_history,
            aspect_ratio, resolution, tier="free"
        )
        if result.success:
            return result
        print(f"  Gemini free tier fejlede: {result.error}, prøver paid tier...")

    # Fallback to paid tier
    if GEMINI_API_KEY_PAID:
        result = _generate_with_gemini(
            prompt, GEMINI_API_KEY_PAID, conversation_history,
            aspect_ratio, resolution, tier="paid"
        )
        if result.success:
            return result
        print(f"  Gemini paid tier fejlede: {result.error}")

    return ImageGenerationResult(
        success=False,
        error="Ingen Gemini API keys konfigureret eller begge fejlede"
    )


def _generate_with_gemini(
    prompt: str,
    api_key: str,
    conversation_history: Optional[List[ConversationTurn]],
    aspect_ratio: str,
    resolution: str,
    tier: str
) -> ImageGenerationResult:
    """Generate image using Gemini API."""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        # Map resolution to API format
        size_map = {"1k": "1K", "2k": "2K", "4k": "4K"}
        image_size = size_map.get(resolution.lower(), "2K")

        # Build config with image modality and system instruction
        config = types.GenerateContentConfig(
            system_instruction=IMAGE_SYSTEM_INSTRUCTION,
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=aspect_ratio,
                image_size=image_size
            )
        )

        # Use chat for multi-turn or simple generate for single turn
        if conversation_history:
            # Build history for chat
            history = []
            for turn in conversation_history:
                parts = []
                if turn.text:
                    parts.append(types.Part(text=turn.text))
                if turn.image_base64:
                    # Include previous image with thought_signature for multi-turn
                    image_part_kwargs = {
                        "inline_data": types.Blob(
                            data=base64.b64decode(turn.image_base64),
                            mime_type=turn.image_mime_type or "image/png"
                        )
                    }
                    # thought_signature is required for model-generated images
                    if turn.thought_signature:
                        image_part_kwargs["thought_signature"] = base64.b64decode(turn.thought_signature)
                    parts.append(types.Part(**image_part_kwargs))
                if parts:
                    history.append(types.Content(role=turn.role, parts=parts))

            chat = client.chats.create(
                model=IMAGE_MODEL,
                config=config,
                history=history
            )
            response = chat.send_message(prompt)
        else:
            # Single turn - direct generation
            response = client.models.generate_content(
                model=IMAGE_MODEL,
                contents=prompt,
                config=config
            )

        # Extract token counts
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) or 0
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) or 0

        # Extract image and text from response
        image_base64 = None
        image_mime_type = None
        text_response = None
        thought_signature = None
        images_count = 0

        for part in response.parts:
            if part.inline_data is not None:
                # Image data
                image_base64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                image_mime_type = part.inline_data.mime_type
                images_count += 1
                # Extract thought_signature for multi-turn (required for editing)
                if hasattr(part, 'thought_signature') and part.thought_signature:
                    thought_signature = base64.b64encode(part.thought_signature).decode('utf-8')
            elif part.text:
                text_response = part.text
                # Text parts can also have thought_signature
                if not thought_signature and hasattr(part, 'thought_signature') and part.thought_signature:
                    thought_signature = base64.b64encode(part.thought_signature).decode('utf-8')

        if not image_base64:
            return ImageGenerationResult(
                success=False,
                error="Ingen billede i respons fra Gemini",
                text_response=text_response,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                api_tier=tier
            )

        return ImageGenerationResult(
            success=True,
            image_base64=image_base64,
            image_mime_type=image_mime_type,
            text_response=text_response,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            images_generated=images_count,
            api_tier=tier,
            thought_signature=thought_signature
        )

    except Exception as e:
        return ImageGenerationResult(
            success=False,
            error=f"Gemini API fejl: {str(e)}"
        )


def save_image_to_file(image_base64: str, filename: str, output_dir: Path) -> Path:
    """Save base64 image to file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    # Sanitize filename to prevent path traversal
    safe_filename = Path(filename).name
    filepath = output_dir / safe_filename
    image_bytes = base64.b64decode(image_base64)
    filepath.write_bytes(image_bytes)
    return filepath
