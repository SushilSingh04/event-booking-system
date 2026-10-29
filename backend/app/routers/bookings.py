from typing import Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, Query, Response, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException
from app.database import get_database
from app.schemas.booking import BookingDetailResponse, BookingResponse
from app.services.booking_service import cancel_booking, get_user_bookings
from app.utils.qr_generator import generate_ticket_qr

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get(
    "/me",
    response_model=list[BookingDetailResponse],
    summary="Get current user's bookings with upcoming/past filtering",
)
async def get_my_bookings(
    timeframe: Optional[str] = Query(
        default="all",
        pattern="^(all|upcoming|past)$",
        description="Filter bookings by event timeframe: all, upcoming, or past",
    ),
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await get_user_bookings(
        db=db,
        user_id=current_user["_id"],
        timeframe=timeframe,
    )


@router.get(
    "/{id}/ticket",
    responses={
        200: {
            "content": {"image/png": {}},
            "description": "Returns a PNG QR code encoding the ticket_code.",
        }
    },
    summary="Download ticket PNG QR code (Booking owner only)",
)
async def get_ticket_qr_code(
    id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    if not ObjectId.is_valid(id):
        raise NotFoundException(message=f"Booking with id '{id}' was not found")

    booking = await db.bookings.find_one({"_id": ObjectId(id)})
    if not booking:
        raise NotFoundException(message=f"Booking with id '{id}' was not found")

    # Enforce strictly: accessible only to the booking owner
    if str(booking["user_id"]) != str(current_user["_id"]):
        raise ForbiddenException(message="Access denied: only the booking owner can access this ticket QR code")

    qr_png_bytes = generate_ticket_qr(booking["ticket_code"])
    return Response(content=qr_png_bytes, media_type="image/png")


@router.delete(
    "/{id}",
    response_model=BookingResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel a booking (Owner or Admin only)",
)
async def cancel_user_booking(
    id: str,
    current_user: dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    return await cancel_booking(
        db=db,
        user=current_user,
        booking_id=id,
    )
