"""Ties the graph, the cache, and the repository together behind the shape
the API needs: submit (fast, returns immediately), stream (SSE-friendly
async generator of node events + final result), and get (idempotent
lookup of a completed analysis).
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from app.cache.analysis_cache import compute_cache_key
from app.config import Settings
from app.db.repositories import AnalysisRepository
from app.graph.nodes.adjudicate import rollup_overall_confidence, rollup_overall_verdict
from app.schemas.result import AnalysisResult
from app.schemas.state import VeritasState


class AnalysisOrchestrator:
    def __init__(self, graph, repository: AnalysisRepository, settings: Settings) -> None:
        self._graph = graph
        self._repository = repository
        self._settings = settings
        self._pending: dict[UUID, VeritasState] = {}
        self._lock = asyncio.Lock()

    async def submit(self, raw_text: str) -> tuple[UUID, bool]:
        cache_key = compute_cache_key(
            raw_text, self._settings.groq_model, self._settings.prompt_version
        )
        cached = await self._repository.get_by_cache_key(cache_key)
        if cached is not None:
            return cached.analysis_id, True

        analysis_id = uuid4()
        state = VeritasState(
            analysis_id=analysis_id,
            raw_input=raw_text,
            prompt_version=self._settings.prompt_version,
            model_id=self._settings.groq_model,
        )
        async with self._lock:
            self._pending[analysis_id] = state
        return analysis_id, False

    async def get_result(self, analysis_id: UUID) -> AnalysisResult | None:
        return await self._repository.get_by_id(analysis_id)

    async def stream(self, analysis_id: UUID) -> AsyncIterator[tuple[str, dict[str, Any]]]:
        existing = await self._repository.get_by_id(analysis_id)
        if existing is not None:
            async for event in self._replay_cached(existing):
                yield event
            return

        async with self._lock:
            state = self._pending.get(analysis_id)
        if state is None:
            yield "error", {"message": "Unknown or already-consumed analysis_id."}
            return

        async for event in self._run_and_stream(analysis_id, state):
            yield event

    async def _replay_cached(self, result: AnalysisResult) -> AsyncIterator[tuple[str, dict]]:
        for trace_event in result.trace:
            yield "node", {**trace_event.model_dump(mode="json"), "cache_hit": True}
        yield "result", {**result.model_dump(mode="json"), "cache_hit": True}

    async def _run_and_stream(
        self, analysis_id: UUID, initial_state: VeritasState
    ) -> AsyncIterator[tuple[str, dict]]:
        cache_key = compute_cache_key(
            initial_state.raw_input, self._settings.groq_model, self._settings.prompt_version
        )
        state = initial_state

        async for step in self._graph.astream(initial_state, stream_mode="updates"):
            for _node_name, update in step.items():
                # astream(stream_mode="updates") yields each node's raw,
                # unreduced diff - unlike ainvoke()'s return value, it has
                # NOT been passed through the trace field's operator.add
                # reducer (that only happens inside LangGraph's own
                # internal channel bookkeeping). Appending manually here
                # is what run_graph() gets for free from ainvoke().
                new_trace_events = update.get("trace", [])
                merged_update = {**update, "trace": [*state.trace, *new_trace_events]}
                state = state.model_copy(update=merged_update)
                for trace_event in new_trace_events:
                    yield "node", trace_event.model_dump(mode="json")

        async with self._lock:
            self._pending.pop(analysis_id, None)

        if state.error is not None:
            yield "error", state.error.model_dump(mode="json")
            return

        result = self._finalize(state, cache_key)
        await self._repository.save(result)
        yield "result", {**result.model_dump(mode="json"), "cache_hit": False}

    def _finalize(self, state: VeritasState, cache_key: str) -> AnalysisResult:
        overall_verdict = state.overall_verdict or rollup_overall_verdict(state.claim_verdicts)
        overall_confidence = (
            state.overall_confidence
            if state.overall_confidence is not None
            else rollup_overall_confidence(state.claim_verdicts, overall_verdict)
        )
        return AnalysisResult(
            analysis_id=state.analysis_id,
            input_text=state.raw_input,
            input_type=(state.input_type.value if state.input_type else "claim"),
            created_at=datetime.now(timezone.utc),
            claims=state.claims,
            evidence=state.evidence,
            stances=state.stances,
            claim_verdicts=state.claim_verdicts,
            overall_verdict=overall_verdict,
            overall_confidence=overall_confidence,
            explanation=state.explanation or "",
            trace=state.trace,
            cache_hit=False,
            cache_key=cache_key,
            prompt_version=state.prompt_version,
            model_id=state.model_id,
        )
