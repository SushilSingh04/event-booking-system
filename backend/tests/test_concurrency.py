import asyncio
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_concurrency_fifty_requests_ten_seats_never_overbooks(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    """
    Key Concurrency Test:
    - Create an event with 10 seats.
    - Fire 50 simultaneous booking requests using asyncio.gather.
    - Assert that:
      1. Confirmed seats NEVER exceed 10.
      2. Exactly 10 requests receive HTTP 201 Created.
      3. Exactly 40 requests receive HTTP 409 Conflict ('Not enough seats').
      4. available_seats in MongoDB is exactly 0 and NEVER negative.
      5. Exactly 10 unique tickets were generated.
    """
    # 1. Create an event with 10 seats
    admin_id, _ = await create_user_helper("admin_concurrency@test.com", role="admin")
    event_doc = {
        "title": "High-Demand Rock Concert",
        "description": "Flash sale event for concurrency stress test.",
        "venue": "Olympic Stadium",
        "date": datetime.now(timezone.utc) + timedelta(days=14),
        "category": "Music",
        "price": 100.0,
        "total_seats": 10,
        "available_seats": 10,
        "created_by": ObjectId(admin_id),
        "created_at": datetime.now(timezone.utc),
    }
    event_res = await clean_test_db.events.insert_one(event_doc)
    event_id = str(event_res.inserted_id)

    # 2. Prepare 50 distinct authenticated users to simulate real simultaneous buyers
    buyers = []
    for i in range(50):
        _, token = await create_user_helper(f"buyer_{i}@concurrency.test", role="user")
        buyers.append({"Authorization": f"Bearer {token}"})

    # 3. Fire 50 simultaneous booking requests with asyncio.gather
    async def book_seat(headers: dict[str, str]):
        return await client.post(
            f"/events/{event_id}/book",
            json={"seats": 1},
            headers=headers,
        )

    responses = await asyncio.gather(*[book_seat(h) for h in buyers])

    # 4. Assert response statuses
    status_codes = [r.status_code for r in responses]
    success_201_count = status_codes.count(201)
    conflict_409_count = status_codes.count(409)

    assert success_201_count == 10, f"Expected exactly 10 successes, got {success_201_count}"
    assert conflict_409_count == 40, f"Expected exactly 40 rejections, got {conflict_409_count}"
    assert len(status_codes) == 50
    assert set(status_codes) == {201, 409}, f"Unexpected HTTP status codes: {set(status_codes)}"

    # 5. Assert database consistency
    event_after = await clean_test_db.events.find_one({"_id": ObjectId(event_id)})
    assert event_after["available_seats"] == 0, "available_seats must be exactly 0"
    assert event_after["available_seats"] >= 0, "available_seats must never be negative"
    assert event_after["total_seats"] == 10

    # 6. Assert confirmed bookings count and unique tickets
    confirmed_bookings = await clean_test_db.bookings.find({
        "event_id": ObjectId(event_id),
        "status": "confirmed",
    }).to_list(100)

    assert len(confirmed_bookings) == 10
    total_booked_seats = sum(b["seats"] for b in confirmed_bookings)
    assert total_booked_seats == 10, "Total confirmed seats must equal 10"

    ticket_codes = [b["ticket_code"] for b in confirmed_bookings]
    assert len(set(ticket_codes)) == 10, "Every issued ticket code must be unique"
