"""Real embedding provider - sentence-transformers/all-MiniLM-L6-v2, CPU,
loaded once as a process-wide singleton since model load is the expensive
part (~80MB download on first use, then in-memory for the process
lifetime).
"""
from __future__ import annotations

from functools import lru_cache

DIM = 384


class MiniLMEmbeddingProvider:
    dim = DIM

    def __init__(self, model_name: str, device: str) -> None:
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name, device=device)

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return vectors.tolist()


@lru_cache
def get_minilm_provider(model_name: str, device: str) -> MiniLMEmbeddingProvider:
    return MiniLMEmbeddingProvider(model_name=model_name, device=device)
