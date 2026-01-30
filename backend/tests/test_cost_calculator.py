"""Tests for cost calculator utilities."""
import pytest
from src.utils.cost_calculator import (
    calculate_whisper_cost,
    calculate_gemini_cost,
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
        expected = 0.10 + 0.40  # $0.10 input + $0.40 output per million
        assert cost == pytest.approx(expected)

    def test_zero_tokens(self):
        """0 tokens should cost $0."""
        cost = calculate_gemini_cost(0, 0)
        assert cost == 0.0

    def test_typical_request(self):
        """Typical request: 1000 input, 500 output tokens."""
        cost = calculate_gemini_cost(1000, 500)
        expected = (1000 / 1_000_000) * 0.10 + (500 / 1_000_000) * 0.40
        assert cost == pytest.approx(expected)


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
        assert "gemini-2.0-flash" in PRICING["gemini"]
