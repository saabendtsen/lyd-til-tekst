"""API cost calculation utilities."""

# Exchange rate USD to DKK - can be updated as needed
USD_TO_DKK = 7.0

# API pricing (per unit as specified)
PRICING = {
    "openai": {
        "whisper-1": {
            "per_minute": 0.006  # $0.006 per minute
        }
    },
    "gemini": {
        "gemini-2.0-flash": {
            "input_per_million": 0.10,   # $0.10 per million input tokens
            "output_per_million": 0.40   # $0.40 per million output tokens
        },
        "gemini-3-pro-image-preview": {
            "input_per_million": 2.00,   # $2.00 per million input tokens
            "output_per_million": 12.00, # $12.00 per million output tokens
            "image_output_1k_2k": 0.134, # $0.134 per 1K/2K image (1120 tokens)
            "image_output_4k": 0.24      # $0.24 per 4K image
        }
    }
}


def usd_to_dkk(usd: float) -> float:
    """Convert USD to DKK."""
    return usd * USD_TO_DKK


def calculate_whisper_cost(duration_seconds: float, model: str = "whisper-1") -> float:
    """
    Calculate Whisper API cost based on audio duration.

    Args:
        duration_seconds: Audio duration in seconds
        model: Whisper model name (default: whisper-1)

    Returns:
        Cost in USD
    """
    minutes = duration_seconds / 60
    pricing = PRICING["openai"].get(model, PRICING["openai"]["whisper-1"])
    return minutes * pricing["per_minute"]


def calculate_gemini_cost(
    input_tokens: int,
    output_tokens: int,
    model: str = "gemini-2.0-flash"
) -> float:
    """
    Calculate Gemini API cost based on token usage.

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        model: Gemini model name

    Returns:
        Cost in USD
    """
    pricing = PRICING["gemini"].get(model, PRICING["gemini"]["gemini-2.0-flash"])
    input_cost = (input_tokens / 1_000_000) * pricing["input_per_million"]
    output_cost = (output_tokens / 1_000_000) * pricing["output_per_million"]
    return input_cost + output_cost


def calculate_image_generation_cost(
    input_tokens: int = 0,
    output_tokens: int = 0,
    images_generated: int = 0,
    resolution: str = "2k",  # "1k", "2k", or "4k"
    model: str = "gemini-3-pro-image-preview"
) -> float:
    """
    Calculate Gemini image generation cost.

    Args:
        input_tokens: Number of input tokens (prompt)
        output_tokens: Number of output tokens (text response)
        images_generated: Number of images generated
        resolution: Image resolution ("1k", "2k", or "4k")
        model: Model name

    Returns:
        Cost in USD
    """
    pricing = PRICING["gemini"].get(model, PRICING["gemini"]["gemini-3-pro-image-preview"])

    # Text token costs
    input_cost = (input_tokens / 1_000_000) * pricing["input_per_million"]
    output_cost = (output_tokens / 1_000_000) * pricing["output_per_million"]

    # Image output cost (only for image-capable models)
    image_cost = 0.0
    if images_generated > 0:
        if resolution == "4k":
            image_cost = images_generated * pricing.get("image_output_4k", 0)
        else:  # 1k or 2k
            image_cost = images_generated * pricing.get("image_output_1k_2k", 0)

    return input_cost + output_cost + image_cost


def get_exchange_rate() -> float:
    """Get current USD to DKK exchange rate."""
    return USD_TO_DKK
