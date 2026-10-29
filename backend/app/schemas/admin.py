from typing import Optional
from pydantic import BaseModel


class EventRevenueStat(BaseModel):
    event_id: str
    event_title: str
    category: str
    revenue: float
    tickets_sold: int
    bookings_count: int


class DailyBookingStat(BaseModel):
    date: str
    bookings: int
    tickets_sold: int
    revenue: float


class CategoryStat(BaseModel):
    category: str
    revenue: float
    tickets_sold: int
    bookings_count: int


class AdminStatsOverview(BaseModel):
    total_users: int
    total_events: int
    total_bookings: int
    total_revenue: float


class AdminStatsResponse(BaseModel):
    overview: AdminStatsOverview
    revenue_per_event: list[EventRevenueStat]
    bookings_per_day: list[DailyBookingStat]
    top_categories: list[CategoryStat]
