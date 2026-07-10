from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport

from app.api.deps import get_user_repository
from app.db.repositories import InMemoryUserRepository
from app.main import create_app

SIGNUP = {"email": "alice@example.com", "password": "password123"}

SUBSTANTIAL_CLAIM = (
    "The city council approved a $42 million budget for the new transit "
    "line after a unanimous vote on Tuesday evening."
)


@pytest.fixture
async def client():
    app = create_app()
    repo = InMemoryUserRepository()
    app.dependency_overrides[get_user_repository] = lambda: repo
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


class TestSignup:
    async def test_signup_sets_httponly_cookie_and_returns_user(self, client):
        response = await client.post("/api/v1/auth/signup", json=SIGNUP)
        assert response.status_code == 201
        assert response.json()["email"] == SIGNUP["email"]
        set_cookie = response.headers["set-cookie"]
        assert "veritas_token=" in set_cookie
        assert "HttpOnly" in set_cookie

    async def test_signup_then_me_returns_same_email(self, client):
        await client.post("/api/v1/auth/signup", json=SIGNUP)
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 200
        assert response.json()["email"] == SIGNUP["email"]

    async def test_duplicate_signup_is_409(self, client):
        await client.post("/api/v1/auth/signup", json=SIGNUP)
        response = await client.post("/api/v1/auth/signup", json=SIGNUP)
        assert response.status_code == 409

    async def test_signup_email_is_stored_lowercased(self, client):
        await client.post(
            "/api/v1/auth/signup", json={"email": "Alice@Example.com", "password": "password123"}
        )
        response = await client.post("/api/v1/auth/login", json=SIGNUP)
        assert response.status_code == 200

    async def test_short_password_is_422(self, client):
        response = await client.post(
            "/api/v1/auth/signup", json={"email": "bob@example.com", "password": "short"}
        )
        assert response.status_code == 422


class TestLogin:
    async def test_login_with_correct_password_sets_cookie(self, client):
        await client.post("/api/v1/auth/signup", json=SIGNUP)
        client.cookies.clear()
        response = await client.post("/api/v1/auth/login", json=SIGNUP)
        assert response.status_code == 200
        assert "veritas_token=" in response.headers["set-cookie"]

    async def test_wrong_password_and_unknown_email_get_identical_401(self, client):
        await client.post("/api/v1/auth/signup", json=SIGNUP)
        client.cookies.clear()
        wrong_password = await client.post(
            "/api/v1/auth/login", json={"email": SIGNUP["email"], "password": "not-the-password"}
        )
        unknown_email = await client.post(
            "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "password123"}
        )
        assert wrong_password.status_code == 401
        assert unknown_email.status_code == 401
        assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


class TestSession:
    async def test_me_without_cookie_is_401(self, client):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_me_with_garbage_token_is_401(self, client):
        client.cookies.set("veritas_token", "not-a-jwt")
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_logout_clears_session(self, client):
        await client.post("/api/v1/auth/signup", json=SIGNUP)
        response = await client.post("/api/v1/auth/logout")
        assert response.status_code == 204
        assert (await client.get("/api/v1/auth/me")).status_code == 401


class TestAnalyzeGating:
    async def test_analyze_without_cookie_is_401(self, client):
        response = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        assert response.status_code == 401

    async def test_stream_without_cookie_is_401(self, client):
        response = await client.get(
            "/api/v1/analyze/00000000-0000-0000-0000-000000000000/stream"
        )
        assert response.status_code == 401

    async def test_analyze_with_cookie_is_202(self, client):
        await client.post("/api/v1/auth/signup", json=SIGNUP)
        response = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        assert response.status_code == 202
