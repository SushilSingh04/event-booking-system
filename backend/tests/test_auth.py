from httpx import AsyncClient
import pytest


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    payload = {
        "name": "Alice Smith",
        "email": "alice@example.com",
        "password": "StrongPassword1!",
    }
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "alice@example.com"
    assert data["name"] == "Alice Smith"
    assert data["role"] == "user"
    assert "hashed_password" not in data
    assert "id" in data


@pytest.mark.asyncio
async def test_register_duplicate_email_409(client: AsyncClient):
    payload = {
        "name": "Bob Jones",
        "email": "bob@example.com",
        "password": "StrongPassword1!",
    }
    res1 = await client.post("/auth/register", json=payload)
    assert res1.status_code == 201

    # Second attempt with same email
    res2 = await client.post("/auth/register", json=payload)
    assert res2.status_code == 409
    err = res2.json()
    assert err["success"] is False
    assert err["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_register_weak_password_validation_422(client: AsyncClient):
    payload = {
        "name": "Charlie",
        "email": "charlie@example.com",
        "password": "weak",  # too short, missing uppercase, digit, symbol
    }
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 422
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    # Register user
    reg_payload = {
        "name": "David",
        "email": "david@example.com",
        "password": "SecurePassword1!",
    }
    await client.post("/auth/register", json=reg_payload)

    # Login
    login_payload = {
        "email": "david@example.com",
        "password": "SecurePassword1!",
    }
    response = await client.post("/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "david@example.com"
    assert "hashed_password" not in data["user"]


@pytest.mark.asyncio
async def test_login_invalid_credentials_401(client: AsyncClient):
    login_payload = {
        "email": "nonexistent@example.com",
        "password": "WrongPassword1!",
    }
    response = await client.post("/auth/login", json=login_payload)
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_get_current_user_me(client: AsyncClient):
    # Register & Login
    reg_payload = {
        "name": "Eve Adams",
        "email": "eve@example.com",
        "password": "Password123!",
    }
    await client.post("/auth/register", json=reg_payload)

    login_res = await client.post(
        "/auth/login",
        json={"email": "eve@example.com", "password": "Password123!"},
    )
    token = login_res.json()["access_token"]

    # Call /auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_info = me_res.json()
    assert user_info["email"] == "eve@example.com"
    assert user_info["name"] == "Eve Adams"
    assert "hashed_password" not in user_info


@pytest.mark.asyncio
async def test_get_me_unauthorized_without_token(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401
    err = response.json()
    assert err["success"] is False
    assert err["error"]["code"] == "UNAUTHORIZED"
