#!/usr/bin/env python3
"""Create a test user for E2E tests.

Usage:
    cd backend && source venv/bin/activate
    python -m scripts.create_test_user

Or specify custom credentials:
    python -m scripts.create_test_user --username myuser --password mypass123
"""
import argparse
import sys
from pathlib import Path

# Add backend directory to path so we can import src modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.database import SessionLocal, User
from src.auth.utils import hash_password


def create_test_user(username: str = "testuser", password: str = "testpass123"):
    """Create a test user if it doesn't exist."""
    db = SessionLocal()
    try:
        # Check if user exists
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"User '{username}' already exists (id={existing.id})")
            return existing

        # Create user
        user = User(
            username=username,
            password_hash=hash_password(password),
            email=f"{username}@test.local"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"Created test user: {username} (id={user.id})")
        print(f"Password: {password}")
        return user

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create test user for E2E tests")
    parser.add_argument("--username", default="testuser", help="Username (default: testuser)")
    parser.add_argument("--password", default="testpass123", help="Password (default: testpass123)")
    args = parser.parse_args()

    create_test_user(args.username, args.password)
