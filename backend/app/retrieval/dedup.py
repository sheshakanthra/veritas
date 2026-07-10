"""Two-stage evidence deduplication: exact URL match first (cheap), then
near-duplicate text via embedding cosine similarity (catches syndicated
wire copy republished under different URLs/domains).
"""
from __future__ import annotations

import math

from app.providers.embeddings.base import EmbeddingProvider
from app.providers.search.base import SearchHit


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def dedup_by_url(hits: list[SearchHit]) -> list[SearchHit]:
    seen: set[str] = set()
    deduped: list[SearchHit] = []
    for hit in hits:
        if hit.url in seen:
            continue
        seen.add(hit.url)
        deduped.append(hit)
    return deduped


def dedup_near_duplicates(
    hits: list[SearchHit],
    embedding_provider: EmbeddingProvider,
    threshold: float = 0.95,
) -> list[SearchHit]:
    if len(hits) <= 1:
        return hits

    vectors = embedding_provider.embed([f"{h.title} {h.snippet}" for h in hits])
    kept: list[SearchHit] = []
    kept_vectors: list[list[float]] = []
    for hit, vector in zip(hits, vectors, strict=True):
        if any(_cosine(vector, kv) > threshold for kv in kept_vectors):
            continue
        kept.append(hit)
        kept_vectors.append(vector)
    return kept
