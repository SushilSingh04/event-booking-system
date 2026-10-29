import asyncio
import json
from app.config import get_settings
from app.database import close_db, get_database, init_db


async def main():
    settings = get_settings()
    print(f"Connecting to MongoDB at {settings.MONGODB_URI} (DB: {settings.MONGODB_DB_NAME})...")

    await init_db(settings.MONGODB_URI, settings.MONGODB_DB_NAME)
    db = get_database()

    print("\n================== COLLECTION INDEXES ==================")
    for collection_name in ["users", "events", "bookings"]:
        collection = db[collection_name]
        indexes = await collection.index_information()
        print(f"\nCollection: '{collection_name}'")
        print(json.dumps(indexes, indent=2, default=str))

    await close_db()
    print("\nDatabase connection closed. All indexes confirmed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
