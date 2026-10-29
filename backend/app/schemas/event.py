from datetime import datetime, timezone
import math
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    venue: str = Field(..., min_length=2, max_length=300)
    date: datetime
    category: str = Field(..., min_length=2, max_length=100)
    price: float = Field(..., ge=0.0)
    total_seats: int = Field(..., gt=0)

    @field_validator("date")
    @classmethod
    def validate_future_date(cls, v: datetime) -> datetime:
        # Normalize timezone if naive
        compare_date = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        if compare_date <= datetime.now(timezone.utc):
            raise ValueError("Event date must be in the future")
        return v


class EventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, min_length=5, max_length=5000)
    venue: Optional[str] = Field(default=None, min_length=2, max_length=300)
    date: Optional[datetime] = None
    category: Optional[str] = Field(default=None, min_length=2, max_length=100)
    price: Optional[float] = Field(default=None, ge=0.0)
    total_seats: Optional[int] = Field(default=None, gt=0)

    @field_validator("date")
    @classmethod
    def validate_future_date(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            compare_date = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
            if compare_date <= datetime.now(timezone.utc):
                raise ValueError("Event date must be in the future")
        return v


class EventResponse(BaseModel):
    id: str
    title: str
    description: str
    venue: str
    date: datetime
    category: str
    price: float
    total_seats: int
    available_seats: int
    created_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int
    page: int
    limit: int
    total_pages: int

    @classmethod
    def build(cls, items: list[EventResponse], total: int, page: int, limit: int) -> "EventListResponse":
        total_pages = math.ceil(total / limit) if limit > 0 else 1
        return cls(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        )
