"""Single place that decides mock vs real providers based on settings.mock_mode.
Everything above this layer (graph nodes, API routes) only ever sees the
Protocol types in providers/*/base.py.
"""
from __future__ import annotations

from app.config import Settings
from app.providers.embeddings.base import EmbeddingProvider
from app.providers.llm.base import LLMProvider
from app.providers.search.base import WebSearchProvider


def get_llm_provider(settings: Settings) -> LLMProvider:
    if settings.mock_mode:
        from app.providers.llm.mock import MockLLMProvider

        return MockLLMProvider()

    from app.providers.llm.groq_provider import GroqProvider

    return GroqProvider(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        temperature=settings.groq_temperature,
        max_retries=settings.groq_max_retries,
        backoff_base_seconds=settings.groq_backoff_base_seconds,
        schema_repair_max_retries=settings.stance_schema_repair_max_retries,
    )


def get_search_provider(settings: Settings) -> WebSearchProvider:
    if settings.mock_mode or settings.web_search_provider == "mock":
        from app.providers.search.mock import MockSearchProvider

        return MockSearchProvider()

    from app.providers.search.duckduckgo_provider import DuckDuckGoProvider

    return DuckDuckGoProvider()


def get_embedding_provider(settings: Settings) -> EmbeddingProvider:
    if settings.mock_mode:
        from app.providers.embeddings.mock import MockEmbeddingProvider

        return MockEmbeddingProvider()

    from app.providers.embeddings.minilm import get_minilm_provider

    return get_minilm_provider(settings.embedding_model, settings.embedding_device)
