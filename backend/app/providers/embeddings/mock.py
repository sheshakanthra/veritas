"""Deterministic bag-of-hashed-words embedding, offline. Not a real
semantic embedding - it exists so dedup and claim-evidence similarity are
exercised end-to-end in MOCK_MODE without loading sentence-transformers
(which needs torch and a model download on first real use).

Same dimensionality (384) as all-MiniLM-L6-v2 so MockEmbeddingProvider and
the real provider are interchangeable wherever a fixed vector width matters
(e.g. a pgvector column), even though MOCK_MODE never touches the DB.
"""
from __future__ import annotations

import hashlib
import math
import re

_WORD_RE = re.compile(r"[a-z0-9']+")
DIM = 384


def _hash_bucket(word: str, dim: int) -> int:
    digest = hashlib.sha256(word.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % dim


class MockEmbeddingProvider:
    dim = DIM

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(t) for t in texts]

    def _embed_one(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        words = _WORD_RE.findall(text.lower())
        for word in words:
            vec[_hash_bucket(word, self.dim)] += 1.0
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            return vec
        return [v / norm for v in vec]
