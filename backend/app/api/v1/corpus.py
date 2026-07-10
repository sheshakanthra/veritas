from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_session
from app.providers.factory import get_embedding_provider
from app.retrieval.pgvector_store import PgVectorCorpusStore

router = APIRouter(prefix="/api/v1/corpus", tags=["corpus"])


class CorpusIngestRequest(BaseModel):
    url: str
    text: str = Field(min_length=1)


class CorpusIngestResponse(BaseModel):
    ingested: bool
    domain: str


@router.post("/ingest", response_model=CorpusIngestResponse)
async def ingest_document(
    payload: CorpusIngestRequest, session: AsyncSession = Depends(get_session)
) -> CorpusIngestResponse:
    settings = get_settings()
    if settings.mock_mode:
        raise HTTPException(
            status_code=409,
            detail="Corpus ingestion requires a real Postgres+pgvector instance; disable MOCK_MODE.",
        )

    domain = urlparse(payload.url).netloc.lower().removeprefix("www.")
    embedding_provider = get_embedding_provider(settings)
    embedding = embedding_provider.embed([payload.text])[0]

    store = PgVectorCorpusStore(session)
    await store.ingest(url=payload.url, domain=domain, text=payload.text, embedding=embedding)
    return CorpusIngestResponse(ingested=True, domain=domain)
