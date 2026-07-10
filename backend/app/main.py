from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import analyze, auth, corpus, health
from app.config import get_settings
from app.db.repositories import InMemoryAnalysisRepository
from app.graph.build import build_graph
from app.providers.factory import get_embedding_provider, get_llm_provider, get_search_provider
from app.services.orchestrator import AnalysisOrchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings

    llm_provider = get_llm_provider(settings)
    search_provider = get_search_provider(settings)
    embedding_provider = get_embedding_provider(settings)

    # TODO(blocked): corpus_store is None here, so the live graph's retrieve
    # node only fans out to web search, never to the ingested pgvector
    # corpus, even outside MOCK_MODE. Wiring it up needs a request-scoped
    # AsyncSession threaded into a per-request graph instance (the graph
    # itself is a process-wide singleton built once at startup), which is
    # a real design decision - documented as a known limitation in the
    # README rather than guessed at here.
    graph = build_graph(
        llm_provider=llm_provider,
        search_provider=search_provider,
        embedding_provider=embedding_provider,
        settings=settings,
        corpus_store=None,
    )

    repository = InMemoryAnalysisRepository()
    app.state.orchestrator = AnalysisOrchestrator(graph=graph, repository=repository, settings=settings)

    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="VERITAS", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(analyze.router)
    app.include_router(auth.router)
    app.include_router(corpus.router)
    app.include_router(health.router)

    return app


app = create_app()
