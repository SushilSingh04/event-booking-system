from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class BookingCreate(BaseModel):
    seats: int = Field(..., gt=0, le=50, description="Number of seats to reserve (1-50)")


class EventBriefResponse(BaseModel):
    id: str
    title: str
    venue: str
    date: datetime
    category: str
    price: float

    model_config = ConfigDict(from_attributes=True)


class BookingResponse(BaseModel):
    id: str
    user_id: str
    event_id: str
    seats: int
    total_amount: float
    status: Literal["pending", "confirmed", "cancelled"]
    ticket_code: str
    booked_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BookingDetailResponse(BookingResponse):
    event: Optional[EventBriefResponse] = None


class BookingCancelResponse(BaseModel):
    message: str
    booking: BookingResponse
