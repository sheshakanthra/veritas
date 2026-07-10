from __future__ import annotations

from app.config import Settings
from app.graph.build import build_graph, run_graph
from app.providers.embeddings.mock import MockEmbeddingProvider
from app.providers.llm.mock import MockLLMProvider
from app.providers.search.mock import MockSearchProvider
from app.schemas.state import VeritasState

SUBSTANTIAL_CLAIM = (
    "The city council approved a $42 million budget for the new transit "
    "line after a unanimous vote on Tuesday evening."
)


def _settings() -> Settings:
    return Settings(MOCK_MODE=True, NODE_TIMEOUT_SECONDS=30)


def _build():
    settings = _settings()
    return build_graph(
        llm_provider=MockLLMProvider(),
        search_provider=MockSearchProvider(),
        embedding_provider=MockEmbeddingProvider(),
        settings=settings,
        corpus_store=None,
    )


class TestFullPipelineOffline:
    async def test_pipeline_runs_end_to_end_with_no_network(self):
        graph = _build()
        result = await run_graph(graph, VeritasState(raw_input=SUBSTANTIAL_CLAIM))

        assert result.error is None
        assert len(result.claims) >= 1
        assert result.overall_verdict is not None
        assert result.explanation
        node_names = [t.node for t in result.trace]
        assert node_names == ["ingest", "decompose", "retrieve", "stance", "adjudicate", "synthesize"]

    async def test_identical_input_is_deterministic(self):
        graph = _build()
        result_a = await run_graph(graph, VeritasState(raw_input=SUBSTANTIAL_CLAIM))
        result_b = await run_graph(graph, VeritasState(raw_input=SUBSTANTIAL_CLAIM))

        assert result_a.overall_verdict == result_b.overall_verdict
        assert result_a.explanation == result_b.explanation
        assert [c.text for c in result_a.claims] == [c.text for c in result_b.claims]

    async def test_short_input_short_circuits_with_error(self):
        graph = _build()
        result = await run_graph(graph, VeritasState(raw_input="Too short."))

        assert result.error is not None
        assert result.error.code == "input_too_short"
        # graph should have stopped after ingest, not run decompose/etc.
        assert [t.node for t in result.trace] == ["ingest"]

    async def test_every_non_unverifiable_claim_has_a_traceable_span(self):
        graph = _build()
        result = await run_graph(graph, VeritasState(raw_input=SUBSTANTIAL_CLAIM))

        spans_by_claim: dict[str, list[str]] = {}
        for s in result.stances:
            if s.span:
                spans_by_claim.setdefault(s.claim_id, []).append(s.span)

        for cv in result.claim_verdicts:
            if cv.verdict.value == "UNVERIFIABLE":
                continue
            assert spans_by_claim.get(cv.claim_id), f"claim {cv.claim_id} has no traceable span"

    async def test_opinion_only_input_resolves_unverifiable(self):
        graph = _build()
        result = await run_graph(
            graph,
            VeritasState(
                raw_input=(
                    "I think this new transit policy is absolutely the best idea the "
                    "city council has ever proposed for our downtown area."
                )
            ),
        )
        assert result.overall_verdict.value == "UNVERIFIABLE"
