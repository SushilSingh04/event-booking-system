from datetime import datetime, timedelta, timezone
from bson import ObjectId
from httpx import AsyncClient
import pytest


async def create_event(db, admin_id: str, total_seats: int = 10, price: float = 50.0, days_ahead: int = 7) -> str:
    event_doc = {
        "title": f"Test Event {days_ahead}d",
        "description": "Event for booking test suite.",
        "venue": "Test Arena",
        "date": datetime.now(timezone.utc) + timedelta(days=days_ahead),
        "category": "Technology",
        "price": price,
        "total_seats": total_seats,
        "available_seats": total_seats,
        "created_by": ObjectId(admin_id),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.events.insert_one(event_doc)
    return str(res.inserted_id)


@pytest.mark.asyncio
async def test_book_event_success_decrements_seats(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    user_id, token = await create_user_helper("buyer@test.com", role="user")
    admin_id, _ = await create_user_helper("admin_b1@test.com", role="admin")
    event_id = await create_event(clean_test_db, admin_id, total_seats=10, price=30.0)

    headers = {"Authorization": f"Bearer {token}"}
    response = await client.post(
        f"/events/{event_id}/book",
        json={"seats": 3},
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["seats"] == 3
    assert data["total_amount"] == 90.0
    assert data["status"] == "confirmed"
    assert data["ticket_code"].startswith("TKT-")

    # Verify event available_seats was decremented from 10 to 7
    ev = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert ev["available_seats"] == 7


@pytest.mark.asyncio
async def test_overbooking_rejected_with_409(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    _, token = await create_user_helper("greedy@test.com", role="user")
    admin_id, _ = await create_user_helper("admin_b2@test.com", role="admin")
    event_id = await create_event(clean_test_db, admin_id, total_seats=5, price=20.0)

    headers = {"Authorization": f"Bearer {token}"}

    # Request 6 seats when only 5 are available -> 409
    response = await client.post(
        f"/events/{event_id}/book",
        json={"seats": 6},
        headers=headers,
    )
    assert response.status_code == 409
    err = response.json()
    assert err["success"] is False
    assert "Not enough seats" in err["error"]["message"]

    # Seats remain untouched
    ev = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert ev["available_seats"] == 5


@pytest.mark.asyncio
async def test_cancel_booking_by_owner_restores_seats(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    user_id, token = await create_user_helper("canceller@test.com", role="user")
    admin_id, _ = await create_user_helper("admin_b3@test.com", role="admin")
    event_id = await create_event(clean_test_db, admin_id, total_seats=10, price=25.0)

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Book 4 seats (available goes from 10 -> 6)
    book_res = await client.post(
        f"/events/{event_id}/book",
        json={"seats": 4},
        headers=headers,
    )
    assert book_res.status_code == 201
    booking_id = book_res.json()["id"]

    ev = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert ev["available_seats"] == 6

    # 2. Cancel the booking
    cancel_res = await client.delete(f"/bookings/{booking_id}", headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # 3. Check seats restored to 10
    ev_after = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert ev_after["available_seats"] == 10


@pytest.mark.asyncio
async def test_prevent_double_cancellation(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    _, token = await create_user_helper("repeat_cancel@test.com", role="user")
    admin_id, _ = await create_user_helper("admin_b4@test.com", role="admin")
    event_id = await create_event(clean_test_db, admin_id, total_seats=10)

    headers = {"Authorization": f"Bearer {token}"}

    book_res = await client.post(
        f"/events/{event_id}/book",
        json={"seats": 2},
        headers=headers,
    )
    booking_id = book_res.json()["id"]

    # First cancellation succeeds
    res1 = await client.delete(f"/bookings/{booking_id}", headers=headers)
    assert res1.status_code == 200

    # Second cancellation must be rejected with 400
    res2 = await client.delete(f"/bookings/{booking_id}", headers=headers)
    assert res2.status_code == 400
    err = res2.json()
    assert "already cancelled" in err["error"]["message"].lower()

    # Seats must not be restored twice (must be 10, not 12)
    ev = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert ev["available_seats"] == 10


@pytest.mark.asyncio
async def test_cancel_booking_by_admin(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    _, user_token = await create_user_helper("victim@test.com", role="user")
    admin_id, admin_token = await create_user_helper("superadmin@test.com", role="admin")
    event_id = await create_event(clean_test_db, admin_id, total_seats=20)

    # User books
    book_res = await client.post(
        f"/events/{event_id}/book",
        json={"seats": 5},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    booking_id = book_res.json()["id"]

    # Admin cancels user's booking -> succeeds
    cancel_res = await client.delete(
        f"/bookings/{booking_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_unauthorized_user_cannot_cancel_others_booking(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    _, user1_token = await create_user_helper("user1_cancel@test.com", role="user")
    _, user2_token = await create_user_helper("user2_cancel@test.com", role="user")
    admin_id, _ = await create_user_helper("admin_b5@test.com", role="admin")
    event_id = await create_event(clean_test_db, admin_id, total_seats=15)

    # User1 books
    book_res = await client.post(
        f"/events/{event_id}/book",
        json={"seats": 2},
        headers={"Authorization": f"Bearer {user1_token}"},
    )
    booking_id = book_res.json()["id"]

    # User2 attempts to cancel User1's booking -> 403 Forbidden
    cancel_res = await client.delete(
        f"/bookings/{booking_id}",
        headers={"Authorization": f"Bearer {user2_token}"},
    )
    assert cancel_res.status_code == 403
    err = cancel_res.json()
    assert err["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_get_my_bookings_with_lookup_and_timeframe(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    user_id, token = await create_user_helper("history@test.com", role="user")
    admin_id, _ = await create_user_helper("admin_b6@test.com", role="admin")

    # Event 1: in the future (upcoming)
    event_future_id = await create_event(clean_test_db, admin_id, total_seats=50, days_ahead=10)
    # Event 2: in the past
    event_past_id = await create_event(clean_test_db, admin_id, total_seats=50, days_ahead=-5)

    headers = {"Authorization": f"Bearer {token}"}

    # Book both
    await client.post(f"/events/{event_future_id}/book", json={"seats": 1}, headers=headers)
    await client.post(f"/events/{event_past_id}/book", json={"seats": 2}, headers=headers)

    # 1. Fetch all bookings
    res_all = await client.get("/bookings/me?timeframe=all", headers=headers)
    assert res_all.status_code == 200
    all_bookings = res_all.json()
    assert len(all_bookings) == 2
    assert all_bookings[0]["event"] is not None
    assert "title" in all_bookings[0]["event"]

    # 2. Fetch upcoming only
    res_upcoming = await client.get("/bookings/me?timeframe=upcoming", headers=headers)
    assert res_upcoming.status_code == 200
    upcoming = res_upcoming.json()
    assert len(upcoming) == 1
    assert upcoming[0]["event_id"] == event_future_id

    # 3. Fetch past only
    res_past = await client.get("/bookings/me?timeframe=past", headers=headers)
    assert res_past.status_code == 200
    past = res_past.json()
    assert len(past) == 1
    assert past[0]["event_id"] == event_past_id
