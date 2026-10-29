# EventHub — Event Booking & Seat Reservation System

An asynchronous, full-stack event booking platform designed from the ground up to solve one of web engineering's classic headaches: **race conditions during high-demand ticket sales**. 

Built with **FastAPI**, **MongoDB (Motor)**, and **React 19**, EventHub guarantees zero overbooking even when dozens of users compete for the exact same remaining seats at the exact same millisecond.

---

## Why this project?

Most naive ticket booking apps follow a standard read-then-write pattern:
1. Fetch event from database (`available_seats = 1`).
2. In Python/Node, check `if available_seats >= requested_seats`.
3. Write back `available_seats = 0` and insert the booking.

Under flash-sale traffic (e.g. 50 users clicking "Book" simultaneously), multiple requests pass step 2 before any write commits. The result? Negative seat inventory, double-sold tickets, and frustrated users.

EventHub avoids both slow distributed locking (Redis Redlock / pessimistic table locks) and naive read-then-write race conditions by relying on **database-level atomic Compare-and-Swap (CAS)** operators.

### How Atomic CAS works here
When a booking request arrives, we execute a single atomic `find_one_and_update` operation directly inside MongoDB:

```python
filter_query = {
    "_id": event_id,
    "available_seats": {"$gte": requested_seats}
}
update_op = {
    "$inc": {"available_seats": -requested_seats}
}
```

MongoDB serializes document-level writes internally. If 50 requests arrive for an event with only 10 seats remaining, exactly 10 seats are reserved. The 11th request matches `available_seats < requested_seats`, returns `None`, and fails immediately with a clean `409 Conflict` ("Event is sold out"). 

We verified this behavior with an automated Pytest stress test firing 50 concurrent `asyncio.gather` requests. `available_seats` never dips below 0, and total confirmed seats never exceed capacity.

---

## Features

### For Attendees
- **Event Discovery**: Search by keyword, filter by category (`Tech`, `Music`, `Workshop`, `Conference`, `Sports`), and select dates with pagination.
- **Real-Time Seat Selector**: Select 1–10 seats with dynamic price calculation and client-side inventory capping.
- **Scannable QR Tickets**: Every confirmed booking generates a unique ticket token (`TICK-<UUID>`) rendered as a dynamic PNG QR code for download.
- **Self-Service Cancellations**: Cancel upcoming reservations anytime; seats are automatically restored back to the event inventory with double-cancel protection.
- **My Bookings Dashboard**: Clean tabbed view separating upcoming vs. past reservations.

### For Administrators
- **Event Manager**: Full CRUD modal for creating, updating, and deleting events with strict date and capacity validation (you cannot reduce total seats below what's already been booked).
- **Executive Analytics**: Real-time business intelligence aggregating:
  - Total registered users, published events, confirmed bookings, and gross revenue.
  - **Revenue per Event**: Top grossing events plotted on an interactive Recharts bar chart.
  - **Bookings per Day**: 30-day volume trend on a line chart.
  - **Category Breakdown**: Interactive Donut chart with a toggle between revenue share and ticket volume.

### Platform & Security
- **JWT Authentication**: Passwords hashed with Bcrypt (12 rounds). Stateless signed JWTs with expiration and auto-logout on `401 Unauthorized`.
- **Role-Based Access Control (RBAC)**: Route guards protecting admin capabilities at both FastAPI dependencies and React Router levels.
- **Rate Limiting**: Integrated SlowAPI rate limiters on booking endpoints to mitigate scalping scripts.
- **Non-Blocking Background Tasks**: Booking confirmation emails dispatched asynchronously via `aiosmtplib`, with automatic fallback logging if SMTP is unconfigured.
- **100% Statement Test Coverage**: 40 passing Pytest tests covering models, services, edge cases, error handlers, and concurrency.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.11+, FastAPI, Motor (Async MongoDB), Pydantic v2, SlowAPI, aiosmtplib, qrcode (PIL) |
| **Frontend** | React 19, Vite, Tailwind CSS v4, React Router v7, Recharts 3.x, Axios, Lucide Icons |
| **Database** | MongoDB 6.0+ with compound indexes and atomic `$inc` operators |
| **Testing** | Pytest, pytest-asyncio, HTTPX `AsyncClient`, pytest-cov |

---

## Quick Start

### Prerequisites
Make sure you have:
- **Python 3.11+** installed
- **Node.js 20+** and npm installed
- **MongoDB** running locally on port `27017` (or a MongoDB Atlas connection string)

---

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
```

Your `.env` file comes pre-configured for local development:
```ini
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=event_booking_db
JWT_SECRET_KEY=super_secret_local_dev_key_at_least_32_characters_long
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

#### Seed the Database
Populate your database with sample events and users:
```bash
python scripts/seed.py
```

This creates two default accounts for testing:
- **Admin**: `admin@example.com` / `Admin@Password123`
- **User**: `user@example.com` / `User@Password123`

#### Start the FastAPI Server
```bash
uvicorn app.main:create_app --factory --reload --port 8000
```
- API is live at: `http://localhost:8000`
- Interactive Swagger docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

---

### 2. Frontend Setup

In a new terminal window:

```bash
# Navigate to the frontend directory
cd frontend

# Install npm dependencies
npm install

# Create your frontend .env file
cp .env.example .env

# Start the Vite development server
npm run dev
```

The web application will be live at `http://localhost:5173`.

---

## Running the Automated Test Suite

We take testing seriously. The backend includes 40 comprehensive tests covering authentication, RBAC, edge-case validations, error handlers, and the core concurrency guarantees.

To run the full suite with coverage:

```bash
cd backend

# Run all tests with statement coverage
pytest
```

Output:
```
============================== test session starts ==============================
collected 40 items

backend/tests/test_auth.py ...........                                   [ 17%]
backend/tests/test_bookings.py .......                                   [ 35%]
backend/tests/test_concurrency.py .                                      [ 37%]
backend/tests/test_coverage_gap.py .............                         [ 70%]
backend/tests/test_events.py .......                                     [ 85%]
backend/tests/test_extra_features.py ...                                 [ 92%]
backend/tests/test_foundation.py ...                                     [100%]

=============================== tests coverage ================================
TOTAL                                       675 stmts      0 miss   100% COVER
======================= 40 passed in ~34s =======================
```

To run specifically the **concurrency stress test**:
```bash
pytest tests/test_concurrency.py -v
```

---

## Project Structure

```
Event Booking System/
├── backend/
│   ├── app/
│   │   ├── core/           # Security (Bcrypt, JWT), exceptions, rate limiter
│   │   ├── models/         # Pydantic database models
│   │   ├── routers/        # API endpoints: auth, events, bookings, admin
│   │   ├── schemas/        # Request & response validation schemas
│   │   ├── services/       # CAS booking logic, email notifications
│   │   ├── utils/          # In-memory QR code PNG generator
│   │   ├── config.py       # Pydantic BaseSettings (.env loader)
│   │   ├── database.py     # Motor async client & index initialization
│   │   └── main.py         # FastAPI application factory & CORS setup
│   ├── scripts/
│   │   └── seed.py         # Database seeder (sample users & events)
│   ├── tests/              # 40 Pytest test suites (concurrency, RBAC, etc.)
│   ├── pytest.ini          # Pytest and coverage configuration
│   └── requirements.txt    # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client with JWT interceptor & auto-401 logout
│   │   ├── components/     # Reusable UI (Navbar, Modals, Spinners, Route guards)
│   │   ├── context/        # AuthContext for persisted user session
│   │   ├── pages/          # Home, EventList, EventDetails, MyBookings,
│   │   │                   # AdminDashboard, AdminEventManager, Login, Register
│   │   ├── routes/         # Protected and admin-guarded route definitions
│   │   └── utils/          # Date & formatting utilities
│   ├── package.json        # Frontend scripts & dependencies
│   ├── vite.config.js      # Vite build configuration
│   └── tailwind.config.js  # Tailwind CSS v4 styling
│
├── .gitignore              # Ignored files, environments, and reports
└── README.md               # You are here
```

---

## Core API Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register a new user (`user` or `admin`) |
| `POST` | `/auth/login` | Public | Authenticate and obtain JWT bearer token |
| `GET` | `/auth/me` | Authenticated | Retrieve current user profile |
| `GET` | `/events/` | Public | List & search events (search, category, date filters, pagination) |
| `GET` | `/events/{id}` | Public | Get single event details with available seats |
| `POST` | `/events/` | Admin only | Create a new event |
| `PUT` | `/events/{id}` | Admin only | Update an event (validates against sold seats) |
| `DELETE`| `/events/{id}` | Admin only | Delete an event |
| `POST` | `/bookings/` | Authenticated | Atomic seat booking (Rate limited: 10/min) |
| `GET` | `/bookings/my` | Authenticated | View current user's bookings (upcoming / past) |
| `POST` | `/bookings/{id}/cancel` | Owner / Admin | Cancel booking and restore available seats |
| `GET` | `/bookings/{id}/ticket` | Owner only | Stream PNG QR code for admission |
| `GET` | `/admin/stats` | Admin only | Aggregation analytics (revenue, trends, categories) |
| `GET` | `/health` | Public | Database connectivity & service health |

---

## License

This project is licensed under the [MIT License](LICENSE).
Feel free to use, modify, and build upon this project for educational and production workloads.
