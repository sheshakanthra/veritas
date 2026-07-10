from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.repositories import SqlUserRepository, UserRepository
from app.db.session import get_session
from app.schemas.auth import AuthenticatedUser
from app.services.auth import AUTH_COOKIE_NAME, decode_access_token


def get_user_repository(session: AsyncSession = Depends(get_session)) -> UserRepository:
    """Tests override this dependency with an InMemoryUserRepository so the
    auth endpoints run without Postgres."""
    return SqlUserRepository(session)


async def get_current_user(request: Request) -> AuthenticatedUser:
    """Stateless gate: verifies the JWT cookie without a DB hit, so gated
    endpoints stay Postgres-free."""
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    payload = decode_access_token(token, get_settings())
    if payload is None:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    try:
        user_id = UUID(payload.sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Not authenticated.") from None
    return AuthenticatedUser(user_id=user_id, email=payload.email)
