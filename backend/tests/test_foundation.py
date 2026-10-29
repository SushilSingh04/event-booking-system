from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_indexes_created(clean_test_db):
    db = clean_test_db

    # 1. users: unique email
    user_indexes = await db.users.index_information()
    assert "idx_users_email_unique" in user_indexes
    assert user_indexes["idx_users_email_unique"]["key"] == [("email", 1)]
    assert user_indexes["idx_users_email_unique"].get("unique") is True

    # 2. events: text index on title and description
    event_indexes = await db.events.index_information()
    assert "idx_events_text_title_description" in event_indexes
    assert "_fts" in dict(event_indexes["idx_events_text_title_description"]["key"])

    # 3. events: compound index on category, date
    assert "idx_events_category_date" in event_indexes
    assert event_indexes["idx_events_category_date"]["key"] == [
        ("category", 1),
        ("date", 1),
    ]

    # 4. bookings: compound index on user_id, status
    booking_indexes = await db.bookings.index_information()
    assert "idx_bookings_user_id_status" in booking_indexes
    assert booking_indexes["idx_bookings_user_id_status"]["key"] == [
        ("user_id", 1),
        ("status", 1),
    ]

    # 5. bookings: TTL index with partialFilterExpression for pending
    assert "idx_bookings_expires_at_ttl_pending" in booking_indexes
    assert booking_indexes["idx_bookings_expires_at_ttl_pending"]["expireAfterSeconds"] == 0
    assert booking_indexes["idx_bookings_expires_at_ttl_pending"]["partialFilterExpression"] == {
        "status": "pending"
    }


@pytest.mark.asyncio
async def test_global_error_format(client: AsyncClient):
    response = await client.get("/non-existent-route")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "NOT_FOUND"
    assert "message" in data["error"]
