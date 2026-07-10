"""Deterministic, offline stand-in for the DuckDuckGo provider.

Given the same query string, always returns the same hits (domains,
titles, snippets) - no network. Selection and stance "flavor" are derived
from a seeded PRNG keyed by a hash of the query, not Python's global
random state, so results are stable across processes and runs.
"""
from __future__ import annotations

import hashlib
import random
import re

from app.providers.search.base import SearchHit

# (domain, tier) - mirrors a slice of config_data/source_tiers.yaml so the
# mock corpus exercises all three tiers without touching the real allowlist.
_POOL: list[str] = [
    "reuters.com",
    "apnews.com",
    "data.gov",
    "nytimes.com",
    "bbc.com",
    "npr.org",
    "theguardian.com",
    "politifact.com",
    "dailybuzzwire.net",
    "opinionhub.blog",
    "trendingnow24.info",
    "randomtakes.co",
]

_SUPPORT_PHRASES = [
    "Officials confirmed that {topic}, according to newly released records.",
    "Data published this week shows {topic}, matching earlier reports.",
    "\"{topic}\" is accurate, a spokesperson said in a statement.",
]
_REFUTE_PHRASES = [
    "The claim that {topic} is false, investigators concluded.",
    "Officials denied that {topic}, calling the report inaccurate.",
    "Fact-checkers debunked the assertion that {topic} after reviewing the record.",
]
_NEUTRAL_PHRASES = [
    "Coverage of the broader situation did not directly address whether {topic}.",
    "Analysts discussed related events but did not confirm or deny that {topic}.",
]

_WORD_RE = re.compile(r"[A-Za-z0-9']+")


def _topic_fragment(query: str, rng: random.Random) -> str:
    words = _WORD_RE.findall(query)
    if len(words) <= 6:
        return query.strip().rstrip(".")
    start = rng.randint(0, max(0, len(words) - 6))
    return " ".join(words[start : start + 6])


def _seed_for(query: str) -> int:
    digest = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


class MockSearchProvider:
    async def search(self, query: str, max_results: int) -> list[SearchHit]:
        rng = random.Random(_seed_for(query))

        # ~15% of queries deterministically come back empty - this is what
        # lets UNVERIFIABLE be exercised offline without hand-authored
        # fixtures for every "thin evidence" case.
        if rng.random() < 0.15:
            return []

        pool = _POOL.copy()
        rng.shuffle(pool)
        domains = pool[: min(max_results, len(pool))]

        hits: list[SearchHit] = []
        for domain in domains:
            topic = _topic_fragment(query, rng)
            flavor = rng.random()
            if flavor < 0.45:
                phrase = rng.choice(_SUPPORT_PHRASES)
            elif flavor < 0.8:
                phrase = rng.choice(_REFUTE_PHRASES)
            else:
                phrase = rng.choice(_NEUTRAL_PHRASES)
            snippet = phrase.format(topic=topic)
            article_id = int(
                hashlib.sha256(f"{domain}:{query}".encode("utf-8")).hexdigest()[:8], 16
            ) % 100_000
            hits.append(
                SearchHit(
                    url=f"https://{domain}/article/{article_id}",
                    title=f"{topic[:60]} - {domain}",
                    snippet=snippet,
                )
            )
        return hits
