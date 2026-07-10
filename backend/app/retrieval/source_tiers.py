from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

from app.schemas.state import SourceTier

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config_data" / "source_tiers.yaml"


@lru_cache
def _load_tier_map() -> dict[str, SourceTier]:
    raw = yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8"))
    tier_map: dict[str, SourceTier] = {}
    for domain in raw.get("tier_1", []):
        tier_map[domain] = SourceTier.TIER_1
    for domain in raw.get("tier_2", []):
        tier_map[domain] = SourceTier.TIER_2
    return tier_map


def tier_for_domain(domain: str) -> SourceTier:
    domain = domain.lower().removeprefix("www.")
    return _load_tier_map().get(domain, SourceTier.TIER_3)
