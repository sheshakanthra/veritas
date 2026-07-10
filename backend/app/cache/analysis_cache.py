"""cache_key = sha256(normalized_text + model_id + prompt_version).

Identical input must never cost a second Groq call: the API layer checks
this cache before invoking the graph at all, and the cache stores the full
AnalysisResult (not just the LLM completions), so a repeat submission also
skips retrieval.
"""
from __future__ import annotations

import hashlib
import re

_WHITESPACE_RE = re.compile(r"\s+")


def normalize_for_cache_key(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", text.strip().lower())


def compute_cache_key(raw_text: str, model_id: str, prompt_version: str) -> str:
    normalized = normalize_for_cache_key(raw_text)
    payload = f"{normalized}::{model_id}::{prompt_version}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
