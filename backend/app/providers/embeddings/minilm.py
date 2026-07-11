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
        # Lazy + guarded: sentence-transformers is an optional "ml" extra kept
        # out of the default (and Vercel) install to stay under the serverless
        # bundle limit. This provider is only constructed when MOCK_MODE=false,
        # so a missing dependency should be a loud, actionable error - never a
        # silent failure discovered mid-request.
        try:
            from sentence_transformers import SentenceTransformer
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "sentence-transformers is not installed. It is an optional 'ml' "
                "dependency excluded from the default install to keep the serverless "
                "bundle small. Install it with `pip install -e \".[ml]\"` (or "
                "`.[dev,ml]`) for real embeddings, or run with MOCK_MODE=true."
            ) from exc

        self._model = SentenceTransformer(model_name, device=device)

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return vectors.tolist()


@lru_cache
def get_minilm_provider(model_name: str, device: str) -> MiniLMEmbeddingProvider:
    return MiniLMEmbeddingProvider(model_name=model_name, device=device)
