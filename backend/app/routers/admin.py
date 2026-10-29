from datetime import datetime, timedelta, timezone
from typing import Any
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.dependencies import require_admin
from app.database import get_database
from app.schemas.admin import (
    AdminStatsOverview,
    AdminStatsResponse,
    CategoryStat,
    DailyBookingStat,
    EventRevenueStat,
)

router = APIRouter(prefix="/admin", tags=["Admin Analytics"])


@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Get aggregated business analytics and metrics (Admin only)",
)
async def get_admin_stats(
    admin_user: dict[str, Any] = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    # 1. Total counts overview
    total_users = await db.users.count_documents({})
    total_events = await db.events.count_documents({})
    total_bookings = await db.bookings.count_documents({"status": "confirmed"})

    rev_cursor = db.bookings.aggregate([
        {"$match": {"status": "confirmed"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}},
    ])
    rev_result = await rev_cursor.to_list(length=1)
    total_revenue = round(float(rev_result[0]["total"]), 2) if rev_result else 0.0

    overview = AdminStatsOverview(
        total_users=total_users,
        total_events=total_events,
        total_bookings=total_bookings,
        total_revenue=total_revenue,
    )

    # 2. Revenue per event
    rev_per_event_cursor = db.bookings.aggregate([
        {"$match": {"status": "confirmed"}},
        {
            "$group": {
                "_id": "$event_id",
                "revenue": {"$sum": "$total_amount"},
                "tickets_sold": {"$sum": "$seats"},
                "bookings_count": {"$sum": 1},
            }
        },
        {"$sort": {"revenue": -1}},
        {"$limit": 10},
        {
            "$lookup": {
                "from": "events",
                "localField": "_id",
                "foreignField": "_id",
                "as": "event",
            }
        },
        {"$unwind": "$event"},
        {
            "$project": {
                "event_id": {"$toString": "$_id"},
                "event_title": "$event.title",
                "category": "$event.category",
                "revenue": {"$round": ["$revenue", 2]},
                "tickets_sold": "$tickets_sold",
                "bookings_count": "$bookings_count",
            }
        },
    ])
    raw_rev_per_event = await rev_per_event_cursor.to_list(length=50)
    revenue_per_event = [EventRevenueStat(**doc) for doc in raw_rev_per_event]

    # 3. Bookings per day for the last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_cursor = db.bookings.aggregate([
        {
            "$match": {
                "status": "confirmed",
                "booked_at": {"$gte": thirty_days_ago},
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$booked_at",
                    }
                },
                "bookings": {"$sum": 1},
                "tickets_sold": {"$sum": "$seats"},
                "revenue": {"$sum": "$total_amount"},
            }
        },
        {"$sort": {"_id": 1}},
        {
            "$project": {
                "date": "$_id",
                "bookings": "$bookings",
                "tickets_sold": "$tickets_sold",
                "revenue": {"$round": ["$revenue", 2]},
            }
        },
    ])
    raw_daily = await daily_cursor.to_list(length=31)
    bookings_per_day = [DailyBookingStat(**doc) for doc in raw_daily]

    # 4. Top categories
    cat_cursor = db.bookings.aggregate([
        {"$match": {"status": "confirmed"}},
        {
            "$lookup": {
                "from": "events",
                "localField": "event_id",
                "foreignField": "_id",
                "as": "event",
            }
        },
        {"$unwind": "$event"},
        {
            "$group": {
                "_id": "$event.category",
                "revenue": {"$sum": "$total_amount"},
                "tickets_sold": {"$sum": "$seats"},
                "bookings_count": {"$sum": 1},
            }
        },
        {"$sort": {"revenue": -1}},
        {
            "$project": {
                "category": "$_id",
                "revenue": {"$round": ["$revenue", 2]},
                "tickets_sold": "$tickets_sold",
                "bookings_count": "$bookings_count",
            }
        },
    ])
    raw_categories = await cat_cursor.to_list(length=20)
    top_categories = [CategoryStat(**doc) for doc in raw_categories]

    return AdminStatsResponse(
        overview=overview,
        revenue_per_event=revenue_per_event,
        bookings_per_day=bookings_per_day,
        top_categories=top_categories,
    )
