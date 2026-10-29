import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

# Add backend directory to sys.path so app modules are resolvable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.core.security import get_password_hash
from app.database import close_db, get_database, init_db


async def seed():
    settings = get_settings()
    print(f"Connecting to MongoDB at {settings.MONGODB_URI} (DB: {settings.MONGODB_DB_NAME})...")
    await init_db(settings.MONGODB_URI, settings.MONGODB_DB_NAME)
    db = get_database()
    users_collection = db["users"]
    events_collection = db["events"]

    # 1. Seed Users
    users_to_seed = [
        {
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "Admin@Password123",
            "role": "admin",
        },
        {
            "name": "Standard User",
            "email": "user@example.com",
            "password": "User@Password123",
            "role": "user",
        },
    ]

    print("\n--- Seeding Users ---")
    admin_id = None
    for user_data in users_to_seed:
        email = user_data["email"].lower()
        existing = await users_collection.find_one({"email": email})
        if existing:
            print(f"[SKIP] User '{email}' already exists.")
            if existing["role"] == "admin":
                admin_id = existing["_id"]
        else:
            doc = {
                "name": user_data["name"],
                "email": email,
                "hashed_password": get_password_hash(user_data["password"]),
                "role": user_data["role"],
                "created_at": datetime.now(timezone.utc),
            }
            result = await users_collection.insert_one(doc)
            print(f"[CREATED] User '{email}' ({user_data['role']}) - ID: {result.inserted_id}")
            if user_data["role"] == "admin":
                admin_id = result.inserted_id

    if not admin_id:
        admin_doc = await users_collection.find_one({"role": "admin"})
        if admin_doc:
            admin_id = admin_doc["_id"]

    # 2. Seed 10 Events across categories
    now = datetime.now(timezone.utc)
    sample_events = [
        {
            "title": "Global Cloud Architecture Summit 2026",
            "description": "Deep-dive workshops and keynote sessions covering microservices, serverless, and cloud security architectures.",
            "venue": "Metropolitan Convention Center, Hall A",
            "date": now + timedelta(days=10, hours=9),
            "category": "Technology",
            "price": 299.99,
            "total_seats": 500,
            "available_seats": 500,
        },
        {
            "title": "Acoustic Sunset Jazz Festival",
            "description": "An evening of smooth jazz, soul melodies, and acoustic performances featuring world-renowned saxophone soloists.",
            "venue": "Riverside Amphitheater, Lawn Stage",
            "date": now + timedelta(days=14, hours=18),
            "category": "Music",
            "price": 45.00,
            "total_seats": 350,
            "available_seats": 350,
        },
        {
            "title": "International AI & Machine Learning Expo",
            "description": "Showcase of generative AI models, autonomous agents, computer vision breakthroughs, and enterprise integrations.",
            "venue": "Tech Innovation Hub, Grand Ballroom",
            "date": now + timedelta(days=21, hours=10),
            "category": "Technology",
            "price": 199.00,
            "total_seats": 400,
            "available_seats": 400,
        },
        {
            "title": "City Half-Marathon & 10K Run",
            "description": "Join thousands of runners in the annual city marathon winding through scenic parks, riverbanks, and downtown avenues.",
            "venue": "Central Park Starting Line",
            "date": now + timedelta(days=25, hours=6),
            "category": "Sports",
            "price": 35.00,
            "total_seats": 1000,
            "available_seats": 1000,
        },
        {
            "title": "Masterclass: Modern Sourdough & Artisan Bread",
            "description": "Hands-on culinary workshop teaching wild yeast cultivation, high-hydration dough techniques, and brick oven baking.",
            "venue": "Downtown Culinary Arts Institute, Studio 3",
            "date": now + timedelta(days=18, hours=14),
            "category": "Workshop",
            "price": 85.50,
            "total_seats": 25,
            "available_seats": 25,
        },
        {
            "title": "Symphony Orchestra: Beethoven & Brahms",
            "description": "Live orchestral masterwork performance by the Philharmonic Orchestra conducted by Maestro Elena Rostov.",
            "venue": "Royal Symphony Hall",
            "date": now + timedelta(days=30, hours=19),
            "category": "Music",
            "price": 75.00,
            "total_seats": 600,
            "available_seats": 600,
        },
        {
            "title": "Contemporary Oil Painting & Abstract Expressionism",
            "description": "Weekend interactive painting workshop focusing on texture layering, pallette knife techniques, and color theory.",
            "venue": "Artisan Loft Studios, Gallery 4",
            "date": now + timedelta(days=12, hours=11),
            "category": "Workshop",
            "price": 60.00,
            "total_seats": 30,
            "available_seats": 30,
        },
        {
            "title": "National Collegiate Basketball Finals",
            "description": "Championship match of the premier collegiate basketball tournament. High stakes and thrilling court action.",
            "venue": "Metro Arena, Main Court",
            "date": now + timedelta(days=40, hours=17),
            "category": "Sports",
            "price": 55.00,
            "total_seats": 850,
            "available_seats": 850,
        },
        {
            "title": "Full-Stack Web Dev with FastAPI & React",
            "description": "Intensive hands-on developer workshop covering async APIs, token authentication, MongoDB queries, and React routing.",
            "venue": "Online Virtual Auditorium 1",
            "date": now + timedelta(days=7, hours=13),
            "category": "Technology",
            "price": 0.00,  # Free event
            "total_seats": 200,
            "available_seats": 200,
        },
        {
            "title": "Indie Film Showcase & Directors Panel",
            "description": "Exclusive screenings of 6 acclaimed independent short films followed by an interactive Q&A with the directors.",
            "venue": "Cinema Paradiso, Screening Room 1",
            "date": now + timedelta(days=28, hours=18),
            "category": "Cinema",
            "price": 20.00,
            "total_seats": 120,
            "available_seats": 120,
        },
    ]

    print("\n--- Seeding Events ---")
    for event_data in sample_events:
        existing_event = await events_collection.find_one({"title": event_data["title"]})
        if existing_event:
            print(f"[SKIP] Event '{event_data['title']}' already exists.")
        else:
            event_doc = {
                **event_data,
                "created_by": admin_id,
                "created_at": datetime.now(timezone.utc),
            }
            result = await events_collection.insert_one(event_doc)
            print(
                f"[CREATED] Event '{event_data['title']}' ({event_data['category']}) - Seats: {event_data['total_seats']} | Price: ${event_data['price']:.2f}"
            )

    await close_db()
    print("\nSeeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
