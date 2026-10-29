from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, Request, status
from motor.motor_asyncio import AsyncIOMotorCollection

from app.core.dependencies import get_current_user
from app.core.exceptions import ConflictException, UnauthorizedException
from app.core.rate_limit import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.database import get_users_collection
from app.schemas.user import TokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    user_in: UserRegister,
    users: AsyncIOMotorCollection = Depends(get_users_collection),
):
    # Normalize email to lower-case
    normalized_email = user_in.email.lower()

    # Reject duplicate email with 409 Conflict
    existing_user = await users.find_one({"email": normalized_email})
    if existing_user:
        raise ConflictException(message="A user with this email address already exists")

    # Hash password and store user
    hashed_password = get_password_hash(user_in.password)
    new_user = {
        "name": user_in.name,
        "email": normalized_email,
        "hashed_password": hashed_password,
        "role": "user",
        "created_at": datetime.now(timezone.utc),
    }

    result = await users.insert_one(new_user)
    new_user["_id"] = result.inserted_id

    return UserResponse(
        id=str(new_user["_id"]),
        name=new_user["name"],
        email=new_user["email"],
        role=new_user["role"],
        created_at=new_user["created_at"],
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive access token",
)
@limiter.limit("10/minute")
async def login(
    request: Request,
    credentials: UserLogin,
    users: AsyncIOMotorCollection = Depends(get_users_collection),
):
    normalized_email = credentials.email.lower()
    user = await users.find_one({"email": normalized_email})

    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise UnauthorizedException(message="Invalid email or password")

    user_id = str(user["_id"])
    access_token = create_access_token(
        subject=user_id,
        extra_claims={
            "name": user["name"],
            "role": user["role"],
        },
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            role=user["role"],
            created_at=user["created_at"],
        ),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve profile of the currently logged-in user",
)
async def get_me(current_user: dict[str, Any] = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        created_at=current_user["created_at"],
    )
