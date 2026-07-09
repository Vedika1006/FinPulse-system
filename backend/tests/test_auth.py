"""
Auth tests.

Note: /auth/register's response model is UserResponse (id, name, email) — it
does NOT return an access_token (only /auth/login does). Tests below assert
the actual response shape rather than an access_token on register.
"""


def test_register_new_user(client):
    resp = client.post(
        "/auth/register",
        json={"email": "newuser@example.com", "password": "SecurePass123", "name": "New User"},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data


def test_register_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "SecurePass123", "name": "Dup User"}
    first = client.post("/auth/register", json=payload)
    assert first.status_code in (200, 201)

    second = client.post("/auth/register", json=payload)
    assert second.status_code == 400


def test_login_success(client):
    client.post(
        "/auth/register",
        json={"email": "login@example.com", "password": "SecurePass123", "name": "Login User"},
    )
    resp = client.post(
        "/auth/login",
        data={"username": "login@example.com", "password": "SecurePass123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post(
        "/auth/register",
        json={"email": "wrongpass@example.com", "password": "SecurePass123", "name": "User"},
    )
    resp = client.post(
        "/auth/login",
        data={"username": "wrongpass@example.com", "password": "IncorrectPass456"},
    )
    assert resp.status_code in (400, 401)
