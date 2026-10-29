from datetime import datetime, timezone
from typing import Any, Optional
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from app.core.dependencies import get_current_user, require_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.rate_limit import limiter
from app.database import get_database, get_events_collection
from app.schemas.booking import BookingCreate, BookingResponse
from app.schemas.event import (
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
)
from app.services.booking_service import create_booking
from app.services.email_service import send_booking_confirmation_email

router = APIRouter(prefix="/events", tags=["Events"])


def _doc_to_response(doc: dict[str, Any]) -> EventResponse:
    """Helper to convert MongoDB document to EventResponse."""
    event_date = doc["date"]
    if isinstance(event_date, datetime) and event_date.tzinfo is None:
        event_date = event_date.replace(tzinfo=timezone.utc)

    created_at = doc.get("created_at")
    if isinstance(created_at, datetime) and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return EventResponse(
        id=str(doc["_id"]),
        title=doc["title"],
        description=doc["description"],
        venue=doc["venue"],
        date=event_date,
        category=doc["category"],
        price=float(doc["price"]),
        total_seats=int(doc["total_seats"]),
        available_seats=int(doc["available_seats"]),
        created_by=str(doc["created_by"]),
        created_at=created_at,
    )


@router.get(
    "",
    response_model=EventListResponse,
    summary="List events with filtering, search, sorting, and pagination",
)
async def list_events(
    search: Optional[str] = Query(default=None, description="Text search on title and description"),
    category: Optional[str] = Query(default=None, description="Filter by event category"),
    start_date: Optional[datetime] = Query(default=None, description="Filter events on or after date"),
    end_date: Optional[datetime] = Query(default=None, description="Filter events on or before date"),
    sort_by: str = Query(default="date", description="Field to sort by (date, price, title, created_at)"),
    sort_order: str = Query(default="asc", pattern="^(asc|desc)$", description="Sort direction: asc or desc"),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Items per page"),
    events: AsyncIOMotorCollection = Depends(get_events_collection),
):
    match_query: dict[str, Any] = {}

    if search:
        match_query["$text"] = {"$search": search}

    if category:
        match_query["category"] = category

    if start_date or end_date:
        date_filter: dict[str, Any] = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        match_query["date"] = date_filter

    pipeline: list[dict[str, Any]] = []

    if match_query:
        pipeline.append({"$match": match_query})

    allowed_sort_fields = {
        "date": "date",
        "price": "price",
        "title": "title",
        "created_at": "created_at",
        "total_seats": "total_seats",
        "available_seats": "available_seats",
    }
    field = allowed_sort_fields.get(sort_by, "date")
    direction = 1 if sort_order.lower() == "asc" else -1
    pipeline.append({"$sort": {field: direction}})

    # Aggregation with $facet stage for items and total count
    pipeline.append({
        "$facet": {
            "metadata": [{"$count": "total"}],
            "data": [
                {"$skip": (page - 1) * limit},
                {"$limit": limit},
            ],
        }
    })

    cursor = events.aggregate(pipeline)
    facet_results = await cursor.to_list(length=1)

    total = 0
    items: list[EventResponse] = []

    if facet_results:
        metadata = facet_results[0].get("metadata", [])
        if metadata:
            total = metadata[0].get("total", 0)

        data = facet_results[0].get("data", [])
        items = [_doc_to_response(doc) for doc in data]

    return EventListResponse.build(items=items, total=total, page=page, limit=limit)


@router.get(
    "/{id}",
    response_model=EventResponse,
    summary="Get single event details by ID",
)
async def get_event(
    id: str,
    events: AsyncIOMotorCollection = Depends(get_events_collection),
):
    if not ObjectId.is_valid(id):
        raise NotFoundException(message=f"Event with id '{id}' was not found")

    event = await events.find_one({"_id": ObjectId(id)})
    if not event:
        raise NotFoundException(message=f"Event with id '{id}' was not found")

    return _doc_to_response(event)


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event (Admin only)",
)
async def create_event(
    event_in: EventCreate,
    admin_user: dict[str, Any] = Depends(require_admin),
    events: AsyncIOMotorCollection = Depends(get_events_collection),
):
    doc = {
        "title": event_in.title,
        "description": event_in.description,
        "venue": event_in.venue,
        "date": event_in.date,
        "category": event_in.category,
        "price": event_in.price,
        "total_seats": event_in.total_seats,
        "available_seats": event_in.total_seats,
        "created_by": admin_user["_id"],
        "created_at": datetime.now(timezone.utc),
    }

    result = await events.insert_one(doc)
    doc["_id"] = result.inserted_id

    return _doc_to_response(doc)


@router.put(
    "/{id}",
    response_model=EventResponse,
    summary="Update an existing event (Admin only)",
)
async def update_event(
    id: str,
    event_in: EventUpdate,
    admin_user: dict[str, Any] = Depends(require_admin),
    events: AsyncIOMotorCollection = Depends(get_events_collection),
):
    if not ObjectId.is_valid(id):
        raise NotFoundException(message=f"Event with id '{id}' was not found")

    existing_event = await events.find_one({"_id": ObjectId(id)})
    if not existing_event:
        raise NotFoundException(message=f"Event with id '{id}' was not found")

    update_fields = event_in.model_dump(exclude_unset=True)

    if "total_seats" in update_fields and update_fields["total_seats"] is not None:
        new_total_seats = update_fields["total_seats"]
        booked_seats = existing_event["total_seats"] - existing_event["available_seats"]

        if new_total_seats < booked_seats:
            raise BadRequestException(
                message=f"Cannot reduce total_seats to {new_total_seats}. There are already {booked_seats} booked seats."
            )

        update_fields["available_seats"] = new_total_seats - booked_seats

    if not update_fields:
        return _doc_to_response(existing_event)

    updated_event = await events.find_one_and_update(
        {"_id": ObjectId(id)},
        {"$set": update_fields},
        return_document=True,
    )

    return _doc_to_response(updated_event)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an event (Admin only)",
)
async def delete_event(
    id: str,
    admin_user: dict[str, Any] = Depends(require_admin),
    events: AsyncIOMotorCollection = Depends(get_events_collection),
):
    if not ObjectId.is_valid(id):
        raise NotFoundException(message=f"Event with id '{id}' was not found")

    result = await events.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 0:
        raise NotFoundException(message=f"Event with id '{id}' was not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{id}/book",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Book seats for an event (Authenticated users, rate-limited)",
)
@limiter.limit("10/minute")
async def book_event_tickets(
    request: Request,
    id: str,
    booking_in: BookingCreate,
    background_tasks: BackgroundTasks,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    booking = await create_booking(
        db=db,
        user=current_user,
        event_id=id,
        seats=booking_in.seats,
    )

    # Enqueue booking confirmation email as a non-blocking background task
    event = await db.events.find_one({"_id": ObjectId(id)})
    if event:
        background_tasks.add_task(
            send_booking_confirmation_email,
            user_email=current_user["email"],
            user_name=current_user["name"],
            event_title=event.get("title", "Event"),
            seats=booking.seats,
            total_amount=booking.total_amount,
            ticket_code=booking.ticket_code,
            event_date=str(event.get("date")),
            venue=event.get("venue", "TBA"),
        )

    return booking
