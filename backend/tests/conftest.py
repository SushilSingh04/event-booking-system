import asyncio
from datetime import datetime, timezone
from typing import AsyncGenerator
from httpx import ASGITransport, AsyncClient
import pytest

from app.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash
from app.database import close_db, create_indexes, get_database, init_db
from app.main import app

TEST_DB_NAME = "event_booking_test_db"


@pytest.fixture(autouse=True)
def disable_rate_limiter():
    """Disable rate limiting during automated testing to avoid 429 throttling."""
    original_state = limiter.enabled
    limiter.enabled = False
    yield
    limiter.enabled = original_state


@pytest.fixture(autouse=True)
async def clean_test_db() -> AsyncGenerator:
    """
    Ensure every test runs against a clean, dedicated test database.
    Drops the database before and after each test.
    """
    settings = get_settings()
    await init_db(settings.MONGODB_URI, TEST_DB_NAME)
    db = get_database()

    # Drop database to start fresh
    await db.client.drop_database(TEST_DB_NAME)
    await create_indexes(db)

    yield db

    # Clean up after test
    await db.client.drop_database(TEST_DB_NAME)
    await close_db()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client connected to the FastAPI application."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.fixture
async def create_user_helper(clean_test_db):
    """Factory fixture to create users and return their id and JWT token."""
    async def _create(email: str, role: str = "user", name: str = "Test User") -> tuple[str, str]:
        user_doc = {
            "name": name,
            "email": email.lower(),
            "hashed_password": get_password_hash("Password123!"),
            "role": role,
            "created_at": datetime.now(timezone.utc),
        }
        res = await clean_test_db.users.insert_one(user_doc)
        user_id = str(res.inserted_id)
        token = create_access_token(
            subject=user_id,
            extra_claims={"name": name, "role": role},
        )
        return user_id, token

    return _create


@pytest.fixture
async def admin_auth(create_user_helper) -> tuple[str, dict[str, str]]:
    """Helper providing an admin user ID and auth header."""
    user_id, token = await create_user_helper("admin@test.com", role="admin", name="Admin User")
    return user_id, {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def user_auth(create_user_helper) -> tuple[str, dict[str, str]]:
    """Helper providing a normal user ID and auth header."""
    user_id, token = await create_user_helper("regular@test.com", role="user", name="Regular User")
    return user_id, {"Authorization": f"Bearer {token}"}
