from __future__ import annotations

import asyncio
from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AnalysisRecord, User
from app.schemas.result import AnalysisResult


class AnalysisRepository(Protocol):
    async def get_by_cache_key(self, cache_key: str) -> AnalysisResult | None: ...

    async def get_by_id(self, analysis_id: UUID) -> AnalysisResult | None: ...

    async def save(self, result: AnalysisResult) -> None: ...


class InMemoryAnalysisRepository:
    """Default repository in MOCK_MODE and for tests - no Postgres
    required. A single process-wide instance backs the whole app via the
    factory below, so repeat submissions within the same run are cached
    exactly like the SQL-backed implementation."""

    def __init__(self) -> None:
        self._by_cache_key: dict[str, AnalysisResult] = {}
        self._by_id: dict[UUID, AnalysisResult] = {}
        self._lock = asyncio.Lock()

    async def get_by_cache_key(self, cache_key: str) -> AnalysisResult | None:
        async with self._lock:
            return self._by_cache_key.get(cache_key)

    async def get_by_id(self, analysis_id: UUID) -> AnalysisResult | None:
        async with self._lock:
            return self._by_id.get(analysis_id)

    async def save(self, result: AnalysisResult) -> None:
        async with self._lock:
            self._by_cache_key[result.cache_key] = result
            self._by_id[result.analysis_id] = result


class SqlAnalysisRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_cache_key(self, cache_key: str) -> AnalysisResult | None:
        stmt = select(AnalysisRecord).where(AnalysisRecord.cache_key == cache_key)
        row = (await self._session.execute(stmt)).scalar_one_or_none()
        return AnalysisResult.model_validate(row.result_json) if row else None

    async def get_by_id(self, analysis_id: UUID) -> AnalysisResult | None:
        row = await self._session.get(AnalysisRecord, analysis_id)
        return AnalysisResult.model_validate(row.result_json) if row else None

    async def save(self, result: AnalysisResult) -> None:
        record = AnalysisRecord(
            analysis_id=result.analysis_id,
            cache_key=result.cache_key,
            result_json=result.model_dump(mode="json"),
        )
        self._session.add(record)
        await self._session.commit()


class UserRepository(Protocol):
    async def get_by_email(self, email: str) -> User | None: ...

    async def create(self, *, email: str, password_hash: str) -> User: ...


class InMemoryUserRepository:
    """Test double - the app always uses SqlUserRepository; tests inject
    this via app.dependency_overrides[get_user_repository] so the auth
    endpoints run without Postgres."""

    def __init__(self) -> None:
        self._by_email: dict[str, User] = {}
        self._lock = asyncio.Lock()

    async def get_by_email(self, email: str) -> User | None:
        async with self._lock:
            return self._by_email.get(email)

    async def create(self, *, email: str, password_hash: str) -> User:
        async with self._lock:
            user = User(id=uuid4(), email=email, password_hash=password_hash)
            self._by_email[email] = user
            return user


class SqlUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def create(self, *, email: str, password_hash: str) -> User:
        user = User(email=email, password_hash=password_hash)
        self._session.add(user)
        await self._session.commit()
        await self._session.refresh(user)
        return user
