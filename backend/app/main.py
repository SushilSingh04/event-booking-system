import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.rate_limit import limiter, rate_limit_handler
from app.database import close_db, get_database, init_db
from app.routers import admin, auth, bookings, events

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler managing database connection and index initialization."""
    settings = get_settings()
    logger.info("Starting up %s...", settings.APP_NAME)
    await init_db(settings.MONGODB_URI, settings.MONGODB_DB_NAME)
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        description="Async FastAPI & MongoDB Event Booking System API",
        lifespan=lifespan,
    )

    # Attach SlowAPI limiter state
    app.state.limiter = limiter

    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Exception Handlers
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # Register Routers
    app.include_router(auth.router)
    app.include_router(events.router)
    app.include_router(bookings.router)
    app.include_router(admin.router)

    # Health Check Endpoint
    @app.get("/health", tags=["Health"], summary="Service Health Check")
    async def health_check():
        try:
            db = get_database()
            await db.command("ping")
            database_status = "connected"
        except Exception as exc:
            logger.error("Health check database ping failed: %s", exc)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "unhealthy",
                    "database": f"disconnected: {str(exc)}",
                    "app": settings.APP_NAME,
                },
            )

        return {
            "status": "healthy",
            "database": database_status,
            "app": settings.APP_NAME,
        }

    return app


app = create_app()
