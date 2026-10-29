from typing import Any
from bson import ObjectId
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.database import get_users_collection

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
) -> dict[str, Any]:
    """Dependency that authenticates the user from the Bearer JWT token."""
    if credentials is None:
        raise UnauthorizedException(message="Authentication token is missing")

    token = credentials.credentials
    payload = decode_access_token(token)
    user_id = payload.get("sub")

    if not user_id or not ObjectId.is_valid(user_id):
        raise UnauthorizedException(message="Invalid token payload or user ID")

    users_collection = get_users_collection()
    user = await users_collection.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise UnauthorizedException(message="User not found or account deactivated")

    return user


async def require_admin(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Dependency enforcing that the authenticated user possesses the 'admin' role."""
    if current_user.get("role") != "admin":
        raise ForbiddenException(message="Admin privilege required to perform this action")

    return current_user
