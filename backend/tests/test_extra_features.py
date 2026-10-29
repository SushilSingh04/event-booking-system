from datetime import datetime, timedelta, timezone
from bson import ObjectId
from httpx import AsyncClient
import pytest

from app.services.email_service import send_booking_confirmation_email


@pytest.mark.asyncio
async def test_admin_stats_endpoint(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    _, admin_token = await create_user_helper("admin_stats@test.com", role="admin")
    user_id, user_token = await create_user_helper("user_stats@test.com", role="user")

    # Create event
    now = datetime.now(timezone.utc)
    ev_res = await clean_test_db.events.insert_one({
        "title": "Data Analytics Conf",
        "description": "Tech conference on pipelines.",
        "venue": "Hall X",
        "date": now + timedelta(days=10),
        "category": "Technology",
        "price": 100.0,
        "total_seats": 100,
        "available_seats": 95,
        "created_by": ObjectId(user_id),
        "created_at": now,
    })
    event_id = ev_res.inserted_id

    # Create confirmed booking
    await clean_test_db.bookings.insert_one({
        "user_id": ObjectId(user_id),
        "event_id": event_id,
        "seats": 5,
        "total_amount": 500.0,
        "status": "confirmed",
        "ticket_code": "TKT-TEST1234",
        "booked_at": now,
        "expires_at": None,
    })

    # Non-admin cannot access stats -> 403 Forbidden
    user_res = await client.get(
        "/admin/stats",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert user_res.status_code == 403

    # Admin can access stats -> 200 OK
    admin_res = await client.get(
        "/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_res.status_code == 200
    stats = admin_res.json()

    # Check overview counts
    assert stats["overview"]["total_events"] >= 1
    assert stats["overview"]["total_bookings"] >= 1
    assert stats["overview"]["total_revenue"] == 500.0

    # Check revenue per event
    assert len(stats["revenue_per_event"]) == 1
    assert stats["revenue_per_event"][0]["event_title"] == "Data Analytics Conf"
    assert stats["revenue_per_event"][0]["revenue"] == 500.0

    # Check top categories
    assert len(stats["top_categories"]) == 1
    assert stats["top_categories"][0]["category"] == "Technology"
    assert stats["top_categories"][0]["revenue"] == 500.0

    # Check daily bookings
    assert len(stats["bookings_per_day"]) >= 1


@pytest.mark.asyncio
async def test_get_ticket_qr_code_png(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    owner_id, owner_token = await create_user_helper("owner_qr@test.com", role="user")
    _, stranger_token = await create_user_helper("stranger_qr@test.com", role="user")

    # Create booking for owner
    now = datetime.now(timezone.utc)
    ev_res = await clean_test_db.events.insert_one({
        "title": "Rock Concert",
        "description": "Live rock show.",
        "venue": "Arena",
        "date": now + timedelta(days=5),
        "category": "Music",
        "price": 50.0,
        "total_seats": 50,
        "available_seats": 49,
        "created_by": ObjectId(owner_id),
        "created_at": now,
    })
    booking_res = await clean_test_db.bookings.insert_one({
        "user_id": ObjectId(owner_id),
        "event_id": ev_res.inserted_id,
        "seats": 1,
        "total_amount": 50.0,
        "status": "confirmed",
        "ticket_code": "TKT-QRTEST99",
        "booked_at": now,
        "expires_at": None,
    })
    booking_id = str(booking_res.inserted_id)

    # Stranger attempts to get ticket -> 403 Forbidden
    stranger_res = await client.get(
        f"/bookings/{booking_id}/ticket",
        headers={"Authorization": f"Bearer {stranger_token}"},
    )
    assert stranger_res.status_code == 403

    # Owner retrieves ticket -> 200 OK, PNG media type
    owner_res = await client.get(
        f"/bookings/{booking_id}/ticket",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_res.status_code == 200
    assert owner_res.headers["content-type"] == "image/png"
    assert owner_res.content[:8] == b"\x89PNG\r\n\x1a\n"


@pytest.mark.asyncio
async def test_email_service_fallback():
    result = await send_booking_confirmation_email(
        user_email="buyer@test.com",
        user_name="John Doe",
        event_title="Jazz Night",
        seats=2,
        total_amount=60.0,
        ticket_code="TKT-MOCK1234",
        event_date="2026-11-01 19:00",
        venue="Jazz Cafe",
    )
    assert result is True
