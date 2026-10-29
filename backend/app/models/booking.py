from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.core.object_id import PyObjectId


class BookingModel(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    user_id: PyObjectId
    event_id: PyObjectId
    seats: int = Field(gt=0)
    total_amount: float = Field(ge=0.0)
    status: Literal["pending", "confirmed", "cancelled"] = "confirmed"
    ticket_code: str
    booked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
