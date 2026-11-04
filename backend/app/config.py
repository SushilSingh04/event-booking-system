import json
from functools import lru_cache
from typing import Any, Union
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "event_booking_db"

    # JWT Authentication
    JWT_SECRET_KEY: str = "supersecretjwtkeythatisatleast32byteslong12345"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS (Typed as Any to prevent pydantic-settings from forcing json.loads on plain strings)
    CORS_ORIGINS: Any = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # SMTP / Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@eventbooking.com"
    SMTP_STARTTLS: bool = True

    # Application
    APP_NAME: str = "Event Booking System API"
    ENVIRONMENT: str = "development"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            clean_v = v.strip()
            # If formatted as a JSON array like ["https://app.vercel.app"]
            if clean_v.startswith("[") and clean_v.endswith("]"):
                try:
                    parsed = json.loads(clean_v)
                    if isinstance(parsed, list):
                        return [str(o).strip().rstrip("/") for o in parsed if o]
                except Exception:
                    pass
            # If formatted as comma-separated or single string like https://app.vercel.app
            return [o.strip().rstrip("/") for o in clean_v.split(",") if o.strip()]
        elif isinstance(v, (list, tuple, set)):
            return [str(o).strip().rstrip("/") for o in v if o]
        raise ValueError("Invalid format for CORS_ORIGINS")

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
