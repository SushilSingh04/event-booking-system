from datetime import datetime, timedelta, timezone
from bson import ObjectId
from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_admin_create_event_success(
    client: AsyncClient,
    create_user_helper,
):
    _, admin_token = await create_user_helper("admin_event_create@test.com", role="admin")

    future_date = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    payload = {
        "title": "Tech Conference 2026",
        "description": "Annual tech conference on distributed systems.",
        "venue": "Convention Center Hall 1",
        "date": future_date,
        "category": "Technology",
        "price": 150.00,
        "total_seats": 200,
    }
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = await client.post("/events", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["available_seats"] == 200
    assert data["total_seats"] == 200
    assert "id" in data


@pytest.mark.asyncio
async def test_non_admin_cannot_create_event(
    client: AsyncClient,
    create_user_helper,
):
    _, user_token = await create_user_helper("user_no_create@test.com", role="user")

    future_date = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    payload = {
        "title": "Unauthorized Event",
        "description": "Should not be created.",
        "venue": "Nowhere",
        "date": future_date,
        "category": "Technology",
        "price": 10.00,
        "total_seats": 50,
    }
    headers = {"Authorization": f"Bearer {user_token}"}
    response = await client.post("/events", json=payload, headers=headers)
    assert response.status_code == 403
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_event_validations_seats_price_date(
    client: AsyncClient,
    create_user_helper,
):
    _, admin_token = await create_user_helper("admin_val@test.com", role="admin")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Past date validation
    past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    res_past = await client.post(
        "/events",
        json={
            "title": "Past Event",
            "description": "Invalid event date in past",
            "venue": "Hall A",
            "date": past_date,
            "category": "Tech",
            "price": 10.0,
            "total_seats": 50,
        },
        headers=headers,
    )
    assert res_past.status_code == 422

    # 2. total_seats <= 0
    future_date = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    res_seats = await client.post(
        "/events",
        json={
            "title": "Zero Seats Event",
            "description": "Zero total seats",
            "venue": "Hall A",
            "date": future_date,
            "category": "Tech",
            "price": 10.0,
            "total_seats": 0,
        },
        headers=headers,
    )
    assert res_seats.status_code == 422

    # 3. price < 0
    res_price = await client.post(
        "/events",
        json={
            "title": "Negative Price Event",
            "description": "Negative price value",
            "venue": "Hall A",
            "date": future_date,
            "category": "Tech",
            "price": -5.0,
            "total_seats": 50,
        },
        headers=headers,
    )
    assert res_price.status_code == 422


@pytest.mark.asyncio
async def test_update_event_block_reducing_seats_below_booked(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    admin_id, admin_token = await create_user_helper("admin_update@test.com", role="admin")

    # Insert an event with 100 total seats and 40 available seats (60 are already booked)
    future_date = datetime.now(timezone.utc) + timedelta(days=15)
    event_doc = {
        "title": "Popular Rock Concert",
        "description": "Live rock music show with 60 booked seats.",
        "venue": "Stadium Arena",
        "date": future_date,
        "category": "Music",
        "price": 50.0,
        "total_seats": 100,
        "available_seats": 40,  # 60 seats booked
        "created_by": ObjectId(admin_id),
        "created_at": datetime.now(timezone.utc),
    }
    res = await clean_test_db.events.insert_one(event_doc)
    event_id = str(res.inserted_id)

    headers = {"Authorization": f"Bearer {admin_token}"}

    # Try to reduce total_seats to 50 (< 60 booked) -> Must fail with 400 Bad Request
    fail_res = await client.put(
        f"/events/{event_id}",
        json={"total_seats": 50},
        headers=headers,
    )
    assert fail_res.status_code == 400
    err = fail_res.json()
    assert err["success"] is False
    assert "Cannot reduce total_seats" in err["error"]["message"]

    # Reduce total_seats to 80 (>= 60 booked) -> Should succeed, available_seats becomes 80 - 60 = 20
    success_res = await client.put(
        f"/events/{event_id}",
        json={"total_seats": 80},
        headers=headers,
    )
    assert success_res.status_code == 200
    updated = success_res.json()
    assert updated["total_seats"] == 80
    assert updated["available_seats"] == 20


@pytest.mark.asyncio
async def test_admin_delete_event(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    admin_id, admin_token = await create_user_helper("admin_del@test.com", role="admin")

    future_date = datetime.now(timezone.utc) + timedelta(days=15)
    res = await clean_test_db.events.insert_one({
        "title": "Event to Delete",
        "description": "Will be deleted.",
        "venue": "Venue X",
        "date": future_date,
        "category": "General",
        "price": 10.0,
        "total_seats": 50,
        "available_seats": 50,
        "created_by": ObjectId(admin_id),
        "created_at": datetime.now(timezone.utc),
    })
    event_id = str(res.inserted_id)

    headers = {"Authorization": f"Bearer {admin_token}"}
    del_res = await client.delete(f"/events/{event_id}", headers=headers)
    assert del_res.status_code == 204

    # Confirm deleted
    get_res = await client.get(f"/events/{event_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_public_get_events_facet_and_filters(
    client: AsyncClient,
    clean_test_db,
    create_user_helper,
):
    admin_id, _ = await create_user_helper("admin_facet@test.com", role="admin")

    # Insert 3 events
    now = datetime.now(timezone.utc)
    await clean_test_db.events.insert_many([
        {
            "title": "Python Async Microservices",
            "description": "FastAPI and Motor in production.",
            "venue": "Hall A",
            "date": now + timedelta(days=5),
            "category": "Technology",
            "price": 100.0,
            "total_seats": 100,
            "available_seats": 100,
            "created_by": ObjectId(admin_id),
            "created_at": now,
        },
        {
            "title": "React and Tailwind Workshop",
            "description": "Build high performance frontend apps.",
            "venue": "Hall B",
            "date": now + timedelta(days=10),
            "category": "Technology",
            "price": 50.0,
            "total_seats": 80,
            "available_seats": 80,
            "created_by": ObjectId(admin_id),
            "created_at": now,
        },
        {
            "title": "Summer Jazz Evening",
            "description": "Live jazz and saxophone outdoor concert.",
            "venue": "Outdoor Park",
            "date": now + timedelta(days=20),
            "category": "Music",
            "price": 25.0,
            "total_seats": 300,
            "available_seats": 300,
            "created_by": ObjectId(admin_id),
            "created_at": now,
        },
    ])

    # 1. Test pagination with $facet
    res = await client.get("/events?page=1&limit=2")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["limit"] == 2
    assert data["total_pages"] == 2

    # 2. Test category filter
    cat_res = await client.get("/events?category=Music")
    assert cat_res.status_code == 200
    cat_data = cat_res.json()
    assert cat_data["total"] == 1
    assert cat_data["items"][0]["title"] == "Summer Jazz Evening"

    # 3. Test text search
    search_res = await client.get("/events?search=Tailwind")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] == 1
    assert "React and Tailwind" in search_data["items"][0]["title"]

    # 4. Test single event GET /events/{id}
    event_id = data["items"][0]["id"]
    single_res = await client.get(f"/events/{event_id}")
    assert single_res.status_code == 200
    assert single_res.json()["id"] == event_id
