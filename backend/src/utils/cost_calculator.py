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
        "gemini-3-flash-preview": {
            "input_per_million": 0.50,   # $0.50 per million input tokens
            "output_per_million": 1.00   # $1.00 per million output tokens
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
    model: str = "gemini-3-flash-preview"
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
    pricing = PRICING["gemini"].get(model, PRICING["gemini"]["gemini-3-flash-preview"])
    input_cost = (input_tokens / 1_000_000) * pricing["input_per_million"]
    output_cost = (output_tokens / 1_000_000) * pricing["output_per_million"]
    return input_cost + output_cost


def get_exchange_rate() -> float:
    """Get current USD to DKK exchange rate."""
    return USD_TO_DKK
