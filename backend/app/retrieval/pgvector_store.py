from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CorpusDocument


@dataclass(frozen=True)
class CorpusHit:
    url: str
    domain: str
    text: str
    similarity: float


class CorpusStore(Protocol):
    async def search(self, query_embedding: list[float], top_k: int) -> list[CorpusHit]: ...

    async def ingest(self, url: str, domain: str, text: str, embedding: list[float]) -> None: ...


class PgVectorCorpusStore:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(self, query_embedding: list[float], top_k: int) -> list[CorpusHit]:
        distance = CorpusDocument.embedding.cosine_distance(query_embedding)
        stmt = select(CorpusDocument, distance.label("distance")).order_by(distance).limit(top_k)
        rows = await self._session.execute(stmt)
        hits: list[CorpusHit] = []
        for doc, dist in rows.all():
            hits.append(
                CorpusHit(url=doc.url, domain=doc.domain, text=doc.text, similarity=1.0 - float(dist))
            )
        return hits

    async def ingest(self, url: str, domain: str, text: str, embedding: list[float]) -> None:
        self._session.add(CorpusDocument(url=url, domain=domain, text=text, embedding=embedding))
        await self._session.commit()
