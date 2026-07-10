from __future__ import annotations

from typing import Protocol
from urllib.parse import urlparse

from pydantic import BaseModel


class SearchHit(BaseModel):
    url: str
    title: str
    snippet: str

    @property
    def domain(self) -> str:
        netloc = urlparse(self.url).netloc.lower()
        return netloc[4:] if netloc.startswith("www.") else netloc


class WebSearchProvider(Protocol):
    async def search(self, query: str, max_results: int) -> list[SearchHit]: ...
