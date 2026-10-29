import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
import pymongo

logger = logging.getLogger(__name__)


class DatabaseManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


db_manager = DatabaseManager()


async def init_db(mongodb_uri: str, db_name: str) -> None:
    """Initialize the shared Motor client and configure database indexes."""
    logger.info("Initializing MongoDB client...")
    db_manager.client = AsyncIOMotorClient(mongodb_uri)
    db_manager.db = db_manager.client[db_name]

    # Verify connectivity
    await db_manager.client.admin.command("ping")
    logger.info("MongoDB connection successfully established to database '%s'.", db_name)

    # Create indexes on startup
    await create_indexes(db_manager.db)


async def close_db() -> None:
    """Close the shared Motor client connection."""
    if db_manager.client is not None:
        logger.info("Closing MongoDB connection...")
        db_manager.client.close()
        db_manager.client = None
        db_manager.db = None
        logger.info("MongoDB connection closed.")


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all required indexes for collections."""
    logger.info("Verifying and creating MongoDB indexes...")

    # 1. users: unique email index
    await db.users.create_index(
        [("email", pymongo.ASCENDING)],
        unique=True,
        name="idx_users_email_unique",
    )
    logger.info("Index verified: idx_users_email_unique on users(email)")

    # 2. events: text index on title and description
    await db.events.create_index(
        [("title", pymongo.TEXT), ("description", pymongo.TEXT)],
        name="idx_events_text_title_description",
    )
    logger.info("Index verified: idx_events_text_title_description on events(title, description)")

    # 3. events: compound index on (category, date)
    await db.events.create_index(
        [("category", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
        name="idx_events_category_date",
    )
    logger.info("Index verified: idx_events_category_date on events(category, date)")

    # 4. bookings: compound index on (user_id, status)
    await db.bookings.create_index(
        [("user_id", pymongo.ASCENDING), ("status", pymongo.ASCENDING)],
        name="idx_bookings_user_id_status",
    )
    logger.info("Index verified: idx_bookings_user_id_status on bookings(user_id, status)")

    # 5. bookings: TTL index on expires_at using partialFilterExpression for pending bookings
    await db.bookings.create_index(
        [("expires_at", pymongo.ASCENDING)],
        expireAfterSeconds=0,
        partialFilterExpression={"status": "pending"},
        name="idx_bookings_expires_at_ttl_pending",
    )
    logger.info(
        "Index verified: idx_bookings_expires_at_ttl_pending on bookings(expires_at) with partialFilterExpression"
    )


def get_database() -> AsyncIOMotorDatabase:
    """FastAPI dependency to retrieve the active database instance."""
    if db_manager.db is None:
        raise RuntimeError("Database is not initialized. Ensure application lifespan is running.")
    return db_manager.db


def get_users_collection() -> AsyncIOMotorCollection:
    return get_database()["users"]


def get_events_collection() -> AsyncIOMotorCollection:
    return get_database()["events"]


def get_bookings_collection() -> AsyncIOMotorCollection:
    return get_database()["bookings"]
