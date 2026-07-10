"""Real web search provider using the unofficial `ddgs` (DuckDuckGo search)
package - free, no API key, but also no SLA. This is the most fragile
dependency in the system: it scrapes a UI DuckDuckGo doesn't officially
support for automation, so it can rate-limit or change shape without
warning. MockSearchProvider is the offline fallback used for all tests and
MOCK_MODE demos; this class is only exercised when MOCK_MODE=false.
"""
from __future__ import annotations

import asyncio

from app.providers.search.base import SearchHit


class DuckDuckGoProvider:
    async def search(self, query: str, max_results: int) -> list[SearchHit]:
        return await asyncio.to_thread(self._search_sync, query, max_results)

    def _search_sync(self, query: str, max_results: int) -> list[SearchHit]:
        from ddgs import DDGS

        with DDGS() as ddgs:
            raw_results = list(ddgs.text(query, max_results=max_results))

        return [
            SearchHit(
                url=r.get("href", ""),
                title=r.get("title", ""),
                snippet=r.get("body", ""),
            )
            for r in raw_results
            if r.get("href")
        ]
