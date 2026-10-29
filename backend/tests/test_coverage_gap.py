from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
from bson import ObjectId
from fastapi import Request
from httpx import AsyncClient
import pytest
from slowapi.errors import RateLimitExceeded

from app.config import Settings
from app.core.exceptions import (
    AppException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
    generic_exception_handler,
)
from app.core.object_id import PyObjectId, validate_object_id
from app.core.rate_limit import rate_limit_handler
from app.core.security import create_access_token, decode_access_token
from app.database import (
    DatabaseManager,
    db_manager,
    get_bookings_collection,
    get_database,
    get_events_collection,
    get_users_collection,
)
from app.main import app, lifespan
from app.models.booking import BookingModel
from app.models.event import EventModel
from app.models.user import UserModel
from app.schemas.event import EventUpdate
from app.schemas.user import UserRegister
from app.services.booking_service import cancel_booking, create_booking
from app.services.email_service import send_booking_confirmation_email


# 1. Models and PyObjectId coverage
def test_py_object_id_validation_and_models():
    oid = ObjectId()
    # Test validator
    assert validate_object_id(oid) == oid
    assert validate_object_id(str(oid)) == oid
    with pytest.raises(ValueError, match="Invalid ObjectId"):
        validate_object_id("invalid-hex-string")

    # Test UserModel instantiation
    user = UserModel(
        _id=oid,
        name="Test",
        email="test@example.com",
        hashed_password="hashed_pwd",
        role="user",
    )
    assert user.name == "Test"

    # Test EventModel instantiation
    event = EventModel(
        _id=oid,
        title="Title",
        description="Desc",
        venue="Venue",
        date=datetime.now(timezone.utc),
        category="Cat",
        price=10.0,
        total_seats=100,
        available_seats=100,
        created_by=oid,
    )
    assert event.total_seats == 100

    # Test BookingModel instantiation
    booking = BookingModel(
        _id=oid,
        user_id=oid,
        event_id=oid,
        seats=2,
        total_amount=20.0,
        ticket_code="TKT-123",
    )
    assert booking.seats == 2


# 2. Config CORS parsing coverage
def test_config_cors_origins_parsing():
    # JSON array string
    s1 = Settings(CORS_ORIGINS='["http://example.com", "http://test.com"]')
    assert s1.CORS_ORIGINS == ["http://example.com", "http://test.com"]

    # Comma-separated string
    s2 = Settings(CORS_ORIGINS="http://alpha.com, http://beta.com")
    assert s2.CORS_ORIGINS == ["http://alpha.com", "http://beta.com"]

    # Invalid JSON string falls back to comma split
    s3 = Settings(CORS_ORIGINS="[invalid json, http://fallback.com]")
    assert len(s3.CORS_ORIGINS) > 0

    # Invalid type
    with pytest.raises(ValueError, match="Invalid format for CORS_ORIGINS"):
        Settings(CORS_ORIGINS=12345)


# 3. Security custom expiry and invalid token
def test_security_custom_expiry_and_invalid_tokens():
    # Custom delta
    token = create_access_token(subject="user_123", expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)
    assert payload["sub"] == "user_123"

    # Invalid token raises UnauthorizedException
    with pytest.raises(UnauthorizedException):
        decode_access_token("this.is.a.bad.jwt.token")


# 4. Password validation branches in UserRegister
def test_user_password_validation_branches():
    # Call validator directly to verify line 16
    with pytest.raises(ValueError, match="at least 8 characters"):
        UserRegister.validate_password_strength("short")

    # Length < 8 via Pydantic model
    with pytest.raises(ValueError):
        UserRegister(name="User", email="u@test.com", password="P1!")

    # No uppercase
    with pytest.raises(ValueError, match="at least one uppercase letter"):
        UserRegister(name="User", email="u@test.com", password="password1!")

    # No lowercase
    with pytest.raises(ValueError, match="at least one lowercase letter"):
        UserRegister(name="User", email="u@test.com", password="PASSWORD1!")

    # No digit
    with pytest.raises(ValueError, match="at least one number"):
        UserRegister(name="User", email="u@test.com", password="Password!!")

    # No special character
    with pytest.raises(ValueError, match="at least one special character"):
        UserRegister(name="User", email="u@test.com", password="Password123")


# 5. EventUpdate schema future date validation
def test_event_update_future_date_validator():
    past_date = datetime.now(timezone.utc) - timedelta(days=2)
    with pytest.raises(ValueError, match="must be in the future"):
        EventUpdate(date=past_date)

    future_date = datetime.now(timezone.utc) + timedelta(days=2)
    eu = EventUpdate(date=future_date)
    assert eu.date == future_date


# 6. Database collections and uninitialized check
def test_database_manager_uninitialized_and_collections():
    original_db = db_manager.db
    db_manager.db = None
    with pytest.raises(RuntimeError, match="Database is not initialized"):
        get_database()
    db_manager.db = original_db

    # Test helper collection getters
    assert get_users_collection() is not None
    assert get_events_collection() is not None
    assert get_bookings_collection() is not None


# 7. Exception handlers and rate limit handler
@pytest.mark.asyncio
async def test_exception_handlers_and_rate_limit():
    dummy_req = Request({"type": "http", "method": "GET", "path": "/"})

    # Generic exception handler 500
    res = await generic_exception_handler(dummy_req, Exception("Unexpected database crash"))
    assert res.status_code == 500

    # Rate limit handler 429
    mock_limit = type("MockLimit", (), {"error_message": "10 per 1 minute", "limit": "10/minute"})()
    exc = RateLimitExceeded(mock_limit)
    res_rl = await rate_limit_handler(dummy_req, exc)
    assert res_rl.status_code == 429


# 8. Dependencies invalid tokens and missing user
@pytest.mark.asyncio
async def test_dependencies_invalid_token_payload_and_deleted_user(client: AsyncClient, clean_test_db):
    # Non-ObjectId sub
    bad_sub_token = create_access_token(subject="not_an_object_id")
    res1 = await client.get("/auth/me", headers={"Authorization": f"Bearer {bad_sub_token}"})
    assert res1.status_code == 401
    assert "Invalid token payload" in res1.json()["error"]["message"]

    # Valid ObjectId sub but user deleted from DB
    deleted_id = str(ObjectId())
    deleted_user_token = create_access_token(subject=deleted_id)
    res2 = await client.get("/auth/me", headers={"Authorization": f"Bearer {deleted_user_token}"})
    assert res2.status_code == 401
    assert "User not found" in res2.json()["error"]["message"]


# 9. Events router edge cases: invalid IDs, not found, empty update, date range filters
@pytest.mark.asyncio
async def test_events_router_edge_cases(client: AsyncClient, clean_test_db, create_user_helper):
    admin_id, admin_token = await create_user_helper("admin_edges@test.com", role="admin")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Invalid ObjectId on GET /events/{id}
    res_get_invalid = await client.get("/events/not-an-id")
    assert res_get_invalid.status_code == 404

    # 2. Invalid ObjectId on PUT /events/{id}
    res_put_invalid = await client.put("/events/not-an-id", json={"title": "New"}, headers=headers)
    assert res_put_invalid.status_code == 404

    # 3. Not found on PUT /events/{id}
    res_put_notfound = await client.put(f"/events/{ObjectId()}", json={"title": "New"}, headers=headers)
    assert res_put_notfound.status_code == 404

    # 4. Invalid ObjectId on DELETE /events/{id}
    res_del_invalid = await client.delete("/events/not-an-id", headers=headers)
    assert res_del_invalid.status_code == 404

    # 5. Not found on DELETE /events/{id}
    res_del_notfound = await client.delete(f"/events/{ObjectId()}", headers=headers)
    assert res_del_notfound.status_code == 404

    # 6. Create event and test empty update (no fields changed)
    now = datetime.now(timezone.utc)
    ev_res = await clean_test_db.events.insert_one({
        "title": "Edge Case Event",
        "description": "Description",
        "venue": "Venue",
        "date": now + timedelta(days=5),
        "category": "Tech",
        "price": 20.0,
        "total_seats": 50,
        "available_seats": 50,
        "created_by": ObjectId(admin_id),
        "created_at": now,
    })
    event_id = str(ev_res.inserted_id)

    res_empty_update = await client.put(f"/events/{event_id}", json={}, headers=headers)
    assert res_empty_update.status_code == 200

    # 7. Date range filtering on GET /events (using Zulu UTC string format)
    start = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end = (now + timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_range = await client.get(f"/events?start_date={start}&end_date={end}")
    assert res_range.status_code == 200
    assert res_range.json()["total"] >= 1


# 10. Bookings router edge cases: invalid IDs on ticket
@pytest.mark.asyncio
async def test_bookings_router_edge_cases(client: AsyncClient, create_user_helper):
    _, user_token = await create_user_helper("buyer_qr_edge@test.com", role="user")
    headers = {"Authorization": f"Bearer {user_token}"}

    # Invalid ObjectId
    res_inv = await client.get("/bookings/invalid-id/ticket", headers=headers)
    assert res_inv.status_code == 404

    # Not found
    res_nf = await client.get(f"/bookings/{ObjectId()}/ticket", headers=headers)
    assert res_nf.status_code == 404


# 11. Booking service edge cases & compensating transaction
@pytest.mark.asyncio
async def test_booking_service_edge_cases_and_compensating_transaction(clean_test_db, create_user_helper):
    user_id, _ = await create_user_helper("svc_user@test.com", role="user")
    user_dict = {"_id": ObjectId(user_id)}

    # Invalid event_id
    with pytest.raises(NotFoundException):
        await create_booking(clean_test_db, user_dict, "not-an-id", 1)

    # Event not found
    with pytest.raises(NotFoundException):
        await create_booking(clean_test_db, user_dict, str(ObjectId()), 1)

    # Invalid booking_id on cancel
    with pytest.raises(NotFoundException):
        await cancel_booking(clean_test_db, user_dict, "not-an-id")

    # Booking not found on cancel
    with pytest.raises(NotFoundException):
        await cancel_booking(clean_test_db, user_dict, str(ObjectId()))

    # Compensating transaction: mock insert_one failure
    now = datetime.now(timezone.utc)
    ev_res = await clean_test_db.events.insert_one({
        "title": "Compensating Test Event",
        "description": "Desc",
        "venue": "Venue",
        "date": now + timedelta(days=5),
        "category": "Tech",
        "price": 10.0,
        "total_seats": 20,
        "available_seats": 20,
        "created_by": ObjectId(user_id),
        "created_at": now,
    })
    event_id = str(ev_res.inserted_id)

    with patch("motor.motor_asyncio.AsyncIOMotorCollection.insert_one", side_effect=Exception("Database write failure")):
        with pytest.raises(BadRequestException, match="Booking transaction failed. Seats have been safely restored"):
            await create_booking(clean_test_db, user_dict, event_id, seats=2)

    # Verify compensating transaction restored seats back to 20
    ev_after = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert ev_after["available_seats"] == 20


# 12. Email service SMTP execution paths (mocking aiosmtplib)
@pytest.mark.asyncio
async def test_email_service_smtp_branches():
    with patch("app.services.email_service.get_settings") as mock_settings:
        mock_settings.return_value.SMTP_HOST = "smtp.realhost.com"
        mock_settings.return_value.SMTP_USERNAME = "real_user@domain.com"
        mock_settings.return_value.SMTP_PASSWORD = "real_secure_password"
        mock_settings.return_value.SMTP_FROM_EMAIL = "noreply@domain.com"
        mock_settings.return_value.SMTP_PORT = 587
        mock_settings.return_value.SMTP_STARTTLS = True
        mock_settings.return_value.APP_NAME = "Test App"

        # Success path
        with patch("aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            res = await send_booking_confirmation_email(
                user_email="buyer@test.com",
                user_name="Buyer",
                event_title="Show",
                seats=1,
                total_amount=25.0,
                ticket_code="TKT-1",
                event_date="2026-11-01",
                venue="Hall",
            )
            assert res is True
            assert mock_send.await_count == 1

        # Failure path (aiosmtplib raises exception)
        with patch("aiosmtplib.send", side_effect=Exception("SMTP server connection timeout")):
            res = await send_booking_confirmation_email(
                user_email="buyer@test.com",
                user_name="Buyer",
                event_title="Show",
                seats=1,
                total_amount=25.0,
                ticket_code="TKT-1",
                event_date="2026-11-01",
                venue="Hall",
            )
            assert res is True  # Handled via fallback logging


# 13. Lifespan and Health check failure coverage
@pytest.mark.asyncio
async def test_lifespan_and_health_check_disconnected(client: AsyncClient):
    # Test lifespan context
    async with lifespan(app):
        pass

    # Test health check disconnected path by mocking get_database ping failure
    with patch("app.main.get_database") as mock_get_db:
        mock_db = AsyncMock()
        mock_db.command.side_effect = Exception("MongoDB connection refused")
        mock_get_db.return_value = mock_db

        res = await client.get("/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "unhealthy"
        assert "disconnected" in data["database"]
