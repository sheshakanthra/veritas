from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    # bcrypt silently truncates at 72 bytes, so longer passwords are rejected
    # up front instead of being accepted with a shorter effective secret.
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class AuthUserResponse(BaseModel):
    user_id: UUID
    email: str


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: UUID
    email: str
