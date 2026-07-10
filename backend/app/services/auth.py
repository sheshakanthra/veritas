from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from pydantic import BaseModel, ConfigDict

from app.config import Settings

# Must match AUTH_COOKIE_NAME in frontend/middleware.ts.
AUTH_COOKIE_NAME = "veritas_token"
JWT_ALGORITHM = "HS256"


class TokenPayload(BaseModel):
    model_config = ConfigDict(frozen=True)

    sub: str
    email: str
    exp: int


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(*, user_id: UUID, email: str, settings: Settings) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.auth_token_ttl_seconds)
    payload = {"sub": str(user_id), "email": email, "exp": int(expires_at.timestamp())}
    return jwt.encode(payload, settings.auth_secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> TokenPayload | None:
    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    return TokenPayload.model_validate(payload)
