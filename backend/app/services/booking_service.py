from datetime import datetime, timezone
import logging
from typing import Any, Optional
import uuid
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.schemas.booking import BookingDetailResponse, BookingResponse, EventBriefResponse

logger = logging.getLogger(__name__)

"""
========================================================================================
CONCURRENCY & OVERBOOKING PREVENTION DESIGN EXPLANATION
========================================================================================
In high-concurrency event ticketing systems, overbooking occurs when multiple requests
read sufficient available capacity at the exact same moment (e.g., both read 1 seat left)
and subsequently both proceed to issue bookings, leaving negative inventory.

Why this design mathematically prevents overbooking:
1. ATOMIC COMPARE-AND-SET (CAS):
   Instead of performing a separate "check available_seats" followed by an "update",
   we execute a single atomic `find_one_and_update` operation directly in MongoDB:
     Filter: {"_id": event_id, "available_seats": {"$gte": requested_seats}}
     Update: {"$inc": {"available_seats": -requested_seats}}
   MongoDB's WiredTiger storage engine acquires a document-level write lock for the
   duration of this operation. Because the condition {"available_seats": {"$gte": n}}
   is evaluated in the same atomic step as the decrement {"$inc": {"available_seats": -n}},
   no other concurrent worker can interleave or observe stale seat counts.
   If two requests attempt to book the last seat concurrently, exactly one will match
   the filter and decrement the seat; the second request will immediately find 0 seats,
   fail the {"$gte": 1} predicate, and return `None` without modifying the document.

2. COMPENSATING TRANSACTION:
   If MongoDB successfully reserves the seats but the subsequent insert of the booking
   record encounters an unexpected failure (e.g., connection drop, timeout, or ticket_code collision),
   a compensating transaction immediately fires:
     Update: {"$inc": {"available_seats": requested_seats}}
   This guarantees that seat capacity is restored and no seats remain orphaned.

3. IDEMPOTENT CANCELLATION & SEAT RESTORATION BOUNDS:
   To prevent double-cancellations (which would artificially inflate available seats),
   we perform an atomic conditional transition on the booking status:
     Filter: {"_id": booking_id, "status": {"$ne": "cancelled"}}
     Update: {"$set": {"status": "cancelled"}}
   If a booking was already cancelled, this returns `None`, rejecting repeated attempts.
   When restoring seats to the event, we use an aggregation pipeline update with `$min`:
     {"available_seats": {"$min": ["$total_seats", {"$add": ["$available_seats", seats]}]}}
   This strictly clamps the inventory so available seats can NEVER exceed total_seats.
========================================================================================
"""


def _generate_ticket_code() -> str:
    """Generate a unique human-readable ticket code."""
    unique_suffix = uuid.uuid4().hex[:8].upper()
    return f"TKT-{unique_suffix}"


def _doc_to_booking_response(doc: dict[str, Any]) -> BookingResponse:
    return BookingResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        event_id=str(doc["event_id"]),
        seats=int(doc["seats"]),
        total_amount=float(doc["total_amount"]),
        status=doc["status"],
        ticket_code=doc["ticket_code"],
        booked_at=doc["booked_at"],
        expires_at=doc.get("expires_at"),
    )


async def create_booking(
    db: AsyncIOMotorDatabase,
    user: dict[str, Any],
    event_id: str,
    seats: int,
) -> BookingResponse:
    """
    Atomically book seats for an event.
    Uses atomic find_one_and_update with available_seats >= seats filter
    to eliminate race conditions and prevent overbooking.
    """
    if not ObjectId.is_valid(event_id):
        raise NotFoundException(message=f"Event with id '{event_id}' was not found")

    events_col = db["events"]
    bookings_col = db["bookings"]
    event_obj_id = ObjectId(event_id)

    # 1. ATOMIC SEAT RESERVATION
    # Atomic condition: available_seats must be >= requested seats
    updated_event = await events_col.find_one_and_update(
        {"_id": event_obj_id, "available_seats": {"$gte": seats}},
        {"$inc": {"available_seats": -seats}},
        return_document=True,
    )

    # If None, either the event does not exist or seats were insufficient
    if updated_event is None:
        existing = await events_col.find_one({"_id": event_obj_id})
        if not existing:
            raise NotFoundException(message=f"Event with id '{event_id}' was not found")
        raise ConflictException(
            message=f"Not enough seats available. Requested: {seats}, Available: {existing.get('available_seats', 0)}"
        )

    # 2. INSERT BOOKING RECORD
    total_amount = round(float(updated_event["price"]) * seats, 2)
    ticket_code = _generate_ticket_code()

    booking_doc = {
        "user_id": user["_id"],
        "event_id": event_obj_id,
        "seats": seats,
        "total_amount": total_amount,
        "status": "confirmed",
        "ticket_code": ticket_code,
        "booked_at": datetime.now(timezone.utc),
        "expires_at": None,
    }

    try:
        result = await bookings_col.insert_one(booking_doc)
        booking_doc["_id"] = result.inserted_id
        logger.info(
            "Booking created: ID=%s, Event=%s, User=%s, Seats=%d, Ticket=%s",
            result.inserted_id,
            event_id,
            user["_id"],
            seats,
            ticket_code,
        )
        return _doc_to_booking_response(booking_doc)
    except Exception as exc:
        # 3. COMPENSATING TRANSACTION: Restore reserved seats on failure
        logger.error(
            "Failed to insert booking for event %s. Executing compensating seat increment: %s",
            event_id,
            exc,
        )
        await events_col.update_one(
            {"_id": event_obj_id},
            {"$inc": {"available_seats": seats}},
        )
        raise BadRequestException(
            message="Booking transaction failed. Seats have been safely restored."
        )


async def cancel_booking(
    db: AsyncIOMotorDatabase,
    user: dict[str, Any],
    booking_id: str,
) -> BookingResponse:
    """
    Cancel an existing booking, preventing double cancellation,
    and restoring seats atomically without exceeding total_seats.
    """
    if not ObjectId.is_valid(booking_id):
        raise NotFoundException(message=f"Booking with id '{booking_id}' was not found")

    bookings_col = db["bookings"]
    events_col = db["events"]
    booking_obj_id = ObjectId(booking_id)

    # 1. Fetch booking to check ownership / role
    booking = await bookings_col.find_one({"_id": booking_obj_id})
    if not booking:
        raise NotFoundException(message=f"Booking with id '{booking_id}' was not found")

    # Only owner or admin can cancel
    is_owner = str(booking["user_id"]) == str(user["_id"])
    is_admin = user.get("role") == "admin"
    if not (is_owner or is_admin):
        raise ForbiddenException(message="You do not have permission to cancel this booking")

    # 2. Prevent double cancellation atomically
    # Only update if current status is NOT 'cancelled'
    updated_booking = await bookings_col.find_one_and_update(
        {"_id": booking_obj_id, "status": {"$ne": "cancelled"}},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}},
        return_document=True,
    )

    if updated_booking is None:
        raise BadRequestException(message="Booking is already cancelled")

    # 3. Restore seats atomically, clamped to never exceed total_seats
    seats_to_restore = booking["seats"]
    await events_col.update_one(
        {"_id": booking["event_id"]},
        [
            {
                "$set": {
                    "available_seats": {
                        "$min": [
                            "$total_seats",
                            {"$add": ["$available_seats", seats_to_restore]},
                        ]
                    }
                }
            }
        ],
    )
    logger.info(
        "Booking %s cancelled. Restored %d seats to event %s.",
        booking_id,
        seats_to_restore,
        booking["event_id"],
    )

    return _doc_to_booking_response(updated_booking)


async def get_user_bookings(
    db: AsyncIOMotorDatabase,
    user_id: ObjectId,
    timeframe: Optional[str] = "all",
) -> list[BookingDetailResponse]:
    """
    Retrieve bookings for a given user, joining event details via $lookup,
    with optional filtering by 'upcoming' or 'past' events.
    """
    bookings_col = db["bookings"]
    now = datetime.now(timezone.utc)

    pipeline: list[dict[str, Any]] = [
        {"$match": {"user_id": user_id}},
        {
            "$lookup": {
                "from": "events",
                "localField": "event_id",
                "foreignField": "_id",
                "as": "event",
            }
        },
        {"$unwind": {"path": "$event", "preserveNullAndEmptyArrays": True}},
    ]

    # Apply upcoming / past filters based on event date
    if timeframe == "upcoming":
        pipeline.append({"$match": {"event.date": {"$gte": now}}})
    elif timeframe == "past":
        pipeline.append({"$match": {"event.date": {"$lt": now}}})

    pipeline.append({"$sort": {"booked_at": -1}})

    cursor = bookings_col.aggregate(pipeline)
    raw_results = await cursor.to_list(length=200)

    results: list[BookingDetailResponse] = []
    for doc in raw_results:
        event_info = None
        if doc.get("event"):
            ev = doc["event"]
            event_info = EventBriefResponse(
                id=str(ev["_id"]),
                title=ev.get("title", ""),
                venue=ev.get("venue", ""),
                date=ev.get("date"),
                category=ev.get("category", ""),
                price=float(ev.get("price", 0.0)),
            )

        results.append(
            BookingDetailResponse(
                id=str(doc["_id"]),
                user_id=str(doc["user_id"]),
                event_id=str(doc["event_id"]),
                seats=int(doc["seats"]),
                total_amount=float(doc["total_amount"]),
                status=doc["status"],
                ticket_code=doc["ticket_code"],
                booked_at=doc["booked_at"],
                expires_at=doc.get("expires_at"),
                event=event_info,
            )
        )

    return results
