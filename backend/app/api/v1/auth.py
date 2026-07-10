from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.exc import IntegrityError

from app.api.deps import get_current_user, get_user_repository
from app.config import Settings, get_settings
from app.db.models import User
from app.db.repositories import UserRepository
from app.schemas.auth import AuthenticatedUser, AuthUserResponse, LoginRequest, SignupRequest
from app.services.auth import AUTH_COOKIE_NAME, create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _set_session_cookie(response: Response, user: User, settings: Settings) -> None:
    token = create_access_token(user_id=user.id, email=user.email, settings=settings)
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        max_age=settings.auth_token_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.auth_cookie_secure,
        path="/",
    )


@router.post("/signup", status_code=201, response_model=AuthUserResponse)
async def signup(
    payload: SignupRequest,
    response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthUserResponse:
    email = payload.email.lower()
    if await repo.get_by_email(email) is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    try:
        user = await repo.create(email=email, password_hash=hash_password(payload.password))
    except IntegrityError:
        # Two concurrent signups can both pass the check above; the DB
        # unique constraint is the authoritative arbiter.
        raise HTTPException(
            status_code=409, detail="An account with this email already exists."
        ) from None
    _set_session_cookie(response, user, get_settings())
    return AuthUserResponse(user_id=user.id, email=user.email)


@router.post("/login", response_model=AuthUserResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    repo: UserRepository = Depends(get_user_repository),
) -> AuthUserResponse:
    email = payload.email.lower()
    user = await repo.get_by_email(email)
    # Identical detail for unknown email and wrong password - no enumeration.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    _set_session_cookie(response, user, get_settings())
    return AuthUserResponse(user_id=user.id, email=user.email)


@router.post("/logout", status_code=204, response_class=Response)
async def logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")
    return response


@router.get("/me", response_model=AuthUserResponse)
async def me(user: AuthenticatedUser = Depends(get_current_user)) -> AuthUserResponse:
    return AuthUserResponse(user_id=user.user_id, email=user.email)
