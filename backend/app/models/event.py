from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.core.object_id import PyObjectId


class EventModel(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    title: str
    description: str
    venue: str
    date: datetime
    category: str
    price: float = Field(ge=0.0)
    total_seats: int = Field(gt=0)
    available_seats: int = Field(ge=0)
    created_by: PyObjectId
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
