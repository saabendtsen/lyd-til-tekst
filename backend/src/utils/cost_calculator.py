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
    minutes = max(0.0, duration_seconds) / 60
    openai_pricing = PRICING.get("openai", {})
    pricing = openai_pricing.get(model, openai_pricing.get("whisper-1", {"per_minute": 0.006}))
    return minutes * pricing.get("per_minute", 0.006)


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
    gemini_pricing = PRICING.get("gemini", {})
    default_pricing = {"input_per_million": 0.10, "output_per_million": 0.40}
    pricing = gemini_pricing.get(model, gemini_pricing.get("gemini-2.0-flash", default_pricing))
    input_cost = (max(0, input_tokens) / 1_000_000) * pricing.get("input_per_million", 0.10)
    output_cost = (max(0, output_tokens) / 1_000_000) * pricing.get("output_per_million", 0.40)
    return input_cost + output_cost


def get_exchange_rate() -> float:
    """Get current USD to DKK exchange rate."""
    return USD_TO_DKK
