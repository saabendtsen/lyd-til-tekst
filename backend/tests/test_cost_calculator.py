"""Tests for cost calculator utilities."""
import pytest
from src.utils.cost_calculator import (
    calculate_whisper_cost,
    calculate_gemini_cost,
    calculate_image_generation_cost,
    usd_to_dkk,
    get_exchange_rate,
    PRICING,
)


class TestWhisperCost:
    """Tests for Whisper cost calculation."""

    def test_one_minute_audio(self):
        """1 minute should cost $0.006."""
        cost = calculate_whisper_cost(60)  # 60 seconds
        assert cost == pytest.approx(0.006)

    def test_ten_minutes_audio(self):
        """10 minutes should cost $0.06."""
        cost = calculate_whisper_cost(600)  # 600 seconds
        assert cost == pytest.approx(0.06)

    def test_zero_duration(self):
        """0 seconds should cost $0."""
        cost = calculate_whisper_cost(0)
        assert cost == 0.0

    def test_fractional_minutes(self):
        """30 seconds = 0.5 minutes = $0.003."""
        cost = calculate_whisper_cost(30)
        assert cost == pytest.approx(0.003)


class TestGeminiCost:
    """Tests for Gemini text cost calculation."""

    def test_one_million_tokens(self):
        """1M input + 1M output tokens."""
        cost = calculate_gemini_cost(1_000_000, 1_000_000)
        expected = 0.50 + 1.00  # $0.50 input + $1.00 output
        assert cost == pytest.approx(expected)

    def test_zero_tokens(self):
        """0 tokens should cost $0."""
        cost = calculate_gemini_cost(0, 0)
        assert cost == 0.0

    def test_typical_request(self):
        """Typical request: 1000 input, 500 output tokens."""
        cost = calculate_gemini_cost(1000, 500)
        expected = (1000 / 1_000_000) * 0.50 + (500 / 1_000_000) * 1.00
        assert cost == pytest.approx(expected)


class TestImageGenerationCost:
    """Tests for image generation cost calculation."""

    def test_single_2k_image(self):
        """Single 2K image should cost $0.134."""
        cost = calculate_image_generation_cost(
            input_tokens=0,
            output_tokens=0,
            images_generated=1,
            resolution="2k"
        )
        assert cost == pytest.approx(0.134)

    def test_single_4k_image(self):
        """Single 4K image should cost $0.24."""
        cost = calculate_image_generation_cost(
            input_tokens=0,
            output_tokens=0,
            images_generated=1,
            resolution="4k"
        )
        assert cost == pytest.approx(0.24)

    def test_image_with_tokens(self):
        """Image + text tokens combined cost."""
        cost = calculate_image_generation_cost(
            input_tokens=1000,
            output_tokens=500,
            images_generated=1,
            resolution="2k"
        )
        token_cost = (1000 / 1_000_000) * 2.00 + (500 / 1_000_000) * 12.00
        image_cost = 0.134
        assert cost == pytest.approx(token_cost + image_cost)

    def test_multiple_images(self):
        """Multiple images should multiply the per-image cost."""
        cost = calculate_image_generation_cost(
            images_generated=3,
            resolution="2k"
        )
        assert cost == pytest.approx(0.134 * 3)

    def test_1k_same_as_2k(self):
        """1K resolution has same price as 2K."""
        cost_1k = calculate_image_generation_cost(images_generated=1, resolution="1k")
        cost_2k = calculate_image_generation_cost(images_generated=1, resolution="2k")
        assert cost_1k == cost_2k


class TestCurrencyConversion:
    """Tests for currency conversion."""

    def test_usd_to_dkk(self):
        """$1 should convert to 7 DKK (default rate)."""
        dkk = usd_to_dkk(1.0)
        assert dkk == pytest.approx(7.0)

    def test_exchange_rate(self):
        """Exchange rate should be positive."""
        rate = get_exchange_rate()
        assert rate > 0


class TestPricingConfig:
    """Tests for pricing configuration."""

    def test_whisper_pricing_exists(self):
        """Whisper pricing should be configured."""
        assert "whisper-1" in PRICING["openai"]
        assert "per_minute" in PRICING["openai"]["whisper-1"]

    def test_gemini_text_pricing_exists(self):
        """Gemini text pricing should be configured."""
        assert "gemini-3-flash-preview" in PRICING["gemini"]

    def test_gemini_image_pricing_exists(self):
        """Gemini image pricing should be configured."""
        assert "gemini-3-pro-image-preview" in PRICING["gemini"]
        pricing = PRICING["gemini"]["gemini-3-pro-image-preview"]
        assert "image_output_1k_2k" in pricing
        assert "image_output_4k" in pricing
