"""Tests for image generation endpoints."""
import base64
from unittest.mock import patch, MagicMock

import pytest

from src.images.generator import (
    ImageGenerationResult,
    ConversationTurn,
    generate_image,
)


# Mock image data (1x1 transparent PNG)
MOCK_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


class TestImageGeneratorUnit:
    """Unit tests for image generator functions."""

    @patch("src.images.generator._generate_with_gemini")
    def test_generate_image_success(self, mock_gemini):
        """Test successful image generation."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            input_tokens=100,
            output_tokens=50,
            images_generated=1,
            api_tier="free"
        )

        result = generate_image("A cat on a beach")

        assert result.success
        assert result.image_base64 == MOCK_IMAGE_BASE64
        assert result.images_generated == 1

    @patch("src.images.generator._generate_with_gemini")
    def test_generate_image_with_history(self, mock_gemini):
        """Test image generation with conversation history."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            images_generated=1,
            api_tier="free"
        )

        history = [
            ConversationTurn(role="user", text="A cat"),
            ConversationTurn(role="model", image_base64=MOCK_IMAGE_BASE64)
        ]

        result = generate_image("Make it orange", conversation_history=history)

        assert result.success
        mock_gemini.assert_called_once()

    @patch("src.images.generator.GEMINI_API_KEY_FREE", None)
    @patch("src.images.generator.GEMINI_API_KEY_PAID", None)
    def test_generate_image_no_api_keys(self):
        """Test error when no API keys configured."""
        result = generate_image("A cat")

        assert not result.success
        assert "API keys" in result.error


class TestImageEndpoints:
    """Integration tests for image API endpoints."""

    def test_generate_requires_auth(self, client):
        """Generate endpoint requires authentication."""
        response = client.post(
            "/api/images/generate",
            json={"prompt": "A cat"}
        )
        assert response.status_code == 401

    @patch("src.images.generator._generate_with_gemini")
    def test_generate_image_endpoint(self, mock_gemini, auth_client, test_db):
        """Test POST /api/images/generate."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            input_tokens=100,
            output_tokens=50,
            images_generated=1,
            api_tier="free"
        )

        response = auth_client.post(
            "/api/images/generate",
            json={
                "prompt": "A beautiful sunset",
                "aspect_ratio": "16:9",
                "resolution": "2k"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["prompt"] == "A beautiful sunset"
        assert data["turn_number"] == 1
        assert "image_url" in data

    @patch("src.images.generator._generate_with_gemini")
    def test_multi_turn_generation(self, mock_gemini, auth_client, test_db):
        """Test multi-turn image editing."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            images_generated=1,
            api_tier="free"
        )

        # First generation
        response1 = auth_client.post(
            "/api/images/generate",
            json={"prompt": "A cat"}
        )
        assert response1.status_code == 200
        gen1 = response1.json()
        assert gen1["turn_number"] == 1

        # Second generation with session_id
        response2 = auth_client.post(
            "/api/images/generate",
            json={
                "prompt": "Make it orange",
                "session_id": gen1["id"]
            }
        )
        assert response2.status_code == 200
        gen2 = response2.json()
        assert gen2["turn_number"] == 2
        assert gen2["parent_id"] == gen1["id"]

    @patch("src.images.generator._generate_with_gemini")
    def test_get_image_data(self, mock_gemini, auth_client, test_db):
        """Test GET /api/images/{id}/data returns image bytes."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            images_generated=1,
            api_tier="free"
        )

        # Generate image first
        gen_response = auth_client.post(
            "/api/images/generate",
            json={"prompt": "A cat"}
        )
        gen_id = gen_response.json()["id"]

        # Get image data
        response = auth_client.get(f"/api/images/{gen_id}/data")

        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert len(response.content) > 0

    @patch("src.images.generator._generate_with_gemini")
    def test_list_generations(self, mock_gemini, auth_client, test_db):
        """Test GET /api/images/ returns user's generations."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            images_generated=1,
            api_tier="free"
        )

        # Generate a few images
        for i in range(3):
            auth_client.post(
                "/api/images/generate",
                json={"prompt": f"Image {i}"}
            )

        # List generations
        response = auth_client.get("/api/images/")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["generations"]) == 3

    @patch("src.images.generator._generate_with_gemini")
    def test_delete_generation(self, mock_gemini, auth_client, test_db):
        """Test DELETE /api/images/{id}."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            images_generated=1,
            api_tier="free"
        )

        # Generate image
        gen_response = auth_client.post(
            "/api/images/generate",
            json={"prompt": "A cat"}
        )
        gen_id = gen_response.json()["id"]

        # Delete it
        response = auth_client.delete(f"/api/images/{gen_id}")
        assert response.status_code == 200

        # Verify it's gone
        response = auth_client.get(f"/api/images/{gen_id}")
        assert response.status_code == 404

    def test_get_nonexistent_image(self, auth_client):
        """Test 404 for nonexistent image."""
        response = auth_client.get("/api/images/99999")
        assert response.status_code == 404

    @patch("src.images.generator._generate_with_gemini")
    def test_api_usage_tracked(self, mock_gemini, auth_client, test_db):
        """Test that image generation is tracked in ApiUsage."""
        mock_gemini.return_value = ImageGenerationResult(
            success=True,
            image_base64=MOCK_IMAGE_BASE64,
            image_mime_type="image/png",
            input_tokens=100,
            output_tokens=50,
            images_generated=1,
            api_tier="free"
        )

        # Generate image
        auth_client.post(
            "/api/images/generate",
            json={"prompt": "A cat", "resolution": "2k"}
        )

        # Check usage
        response = auth_client.get("/api/usage")
        assert response.status_code == 200
        usage = response.json()

        # Find the image generation usage
        image_usage = [u for u in usage if u["operation"] == "generate_image"]
        assert len(image_usage) == 1
        assert image_usage[0]["images_generated"] == 1
        assert image_usage[0]["image_resolution"] == "2k"
        assert image_usage[0]["cost_usd"] > 0
