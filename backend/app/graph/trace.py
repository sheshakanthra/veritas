"""Timing/token/cache_hit instrumentation wrapper for graph nodes, plus a
per-node timeout. Every node in graph/nodes/ is wrapped with `traced`, so
latency_ms, cache_hit, and any error are recorded in state.trace uniformly
instead of each node hand-rolling its own bookkeeping.
"""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable

from app.schemas.state import ErrorCode, TraceEvent, VeritasError, VeritasState

NodeFn = Callable[[VeritasState], Awaitable[dict]]


def traced(node_name: str, fn: NodeFn, timeout_seconds: float | None = None) -> NodeFn:
    async def wrapped(state: VeritasState) -> dict:
        start = time.perf_counter()
        try:
            if timeout_seconds is not None:
                updates = await asyncio.wait_for(fn(state), timeout=timeout_seconds)
            else:
                updates = await fn(state)
        except TimeoutError:
            latency_ms = int((time.perf_counter() - start) * 1000)
            return {
                "trace": [
                    TraceEvent(
                        node=node_name, status="error", latency_ms=latency_ms,
                        error=f"node exceeded {timeout_seconds}s timeout",
                    )
                ],
                "error": VeritasError(
                    code=ErrorCode.NODE_TIMEOUT,
                    message=f"'{node_name}' took longer than {timeout_seconds}s.",
                    node=node_name,
                    retryable=True,
                ),
            }
        except Exception as exc:  # noqa: BLE001 - converted to a typed trace entry
            latency_ms = int((time.perf_counter() - start) * 1000)
            return {
                "trace": [
                    TraceEvent(
                        node=node_name, status="error", latency_ms=latency_ms, error=str(exc)
                    )
                ],
                "error": VeritasError(
                    code=ErrorCode.SCHEMA_VALIDATION_FAILED,
                    message=str(exc),
                    node=node_name,
                    retryable=False,
                ),
            }

        latency_ms = int((time.perf_counter() - start) * 1000)
        token_count = updates.pop("_token_count", None)
        cache_hit = updates.pop("_cache_hit", False)
        updates["trace"] = [
            TraceEvent(
                node=node_name,
                status="done",
                latency_ms=latency_ms,
                token_count=token_count,
                cache_hit=cache_hit,
            )
        ]
        return updates

    return wrapped
