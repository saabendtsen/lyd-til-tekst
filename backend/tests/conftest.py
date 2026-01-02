"""Test fixtures and configuration."""
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ["JWT_SECRET"] = "test-secret-key-for-testing"

from src.main import app
from src.database import Base, get_db, User
from src.auth.utils import hash_password


@pytest.fixture(scope="function")
def test_db():
    """Create a fresh test database for each test."""
    # Use in-memory SQLite for tests
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Override the get_db dependency
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    db = TestingSessionLocal()
    yield db
    db.close()

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture
def client(test_db):
    """Test client with fresh database."""
    return TestClient(app)


@pytest.fixture
def test_user(test_db):
    """Create a test user."""
    user = User(
        username="testuser",
        password_hash=hash_password("testpass123"),
        email="test@example.com"
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_client(client, test_user, test_db):
    """Client with authenticated user."""
    from src.auth.deps import get_current_user

    # Override auth dependency to return test user directly
    def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_user] = override_get_current_user

    yield client

    # Clean up this specific override
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]
