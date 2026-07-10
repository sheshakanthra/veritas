"""Assembles the 6-node LangGraph pipeline:

    ingest -> decompose -> retrieve -> stance -> adjudicate -> synthesize

Every edge is conditional on state.error: once any node sets an error, the
graph short-circuits straight to END instead of running further stages on
a broken state. Each node is wrapped with `traced` for uniform latency/
token/cache_hit bookkeeping and a shared per-node timeout.
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.config import Settings
from app.graph.nodes.adjudicate import make_adjudicate_node
from app.graph.nodes.decompose import make_decompose_node
from app.graph.nodes.ingest import ingest_node
from app.graph.nodes.retrieve import make_retrieve_node
from app.graph.nodes.stance import make_stance_node
from app.graph.nodes.synthesize import make_synthesize_node
from app.graph.trace import traced
from app.providers.embeddings.base import EmbeddingProvider
from app.providers.llm.base import LLMProvider
from app.providers.search.base import WebSearchProvider
from app.retrieval.pgvector_store import CorpusStore
from app.schemas.state import VeritasState


def _route(next_node: str):
    def _fn(state: VeritasState) -> str:
        return END if state.error is not None else next_node

    return _fn


def build_graph(
    llm_provider: LLMProvider,
    search_provider: WebSearchProvider,
    embedding_provider: EmbeddingProvider,
    settings: Settings,
    corpus_store: CorpusStore | None = None,
):
    graph = StateGraph(VeritasState)
    timeout = settings.node_timeout_seconds

    graph.add_node("ingest", traced("ingest", ingest_node, timeout))
    graph.add_node("decompose", traced("decompose", make_decompose_node(llm_provider), timeout))
    graph.add_node(
        "retrieve",
        traced(
            "retrieve",
            make_retrieve_node(
                search_provider=search_provider,
                embedding_provider=embedding_provider,
                corpus_store=corpus_store,
                top_k_corpus=settings.retrieval_top_k_corpus,
                top_k_web=settings.retrieval_top_k_web,
                dedup_threshold=settings.retrieval_dedup_similarity_threshold,
            ),
            timeout,
        ),
    )
    graph.add_node("stance", traced("stance", make_stance_node(llm_provider), timeout))
    graph.add_node("adjudicate", traced("adjudicate", make_adjudicate_node(), timeout))
    graph.add_node("synthesize", traced("synthesize", make_synthesize_node(llm_provider), timeout))

    graph.set_entry_point("ingest")
    graph.add_conditional_edges("ingest", _route("decompose"), ["decompose", END])
    graph.add_conditional_edges("decompose", _route("retrieve"), ["retrieve", END])
    graph.add_conditional_edges("retrieve", _route("stance"), ["stance", END])
    graph.add_conditional_edges("stance", _route("adjudicate"), ["adjudicate", END])
    graph.add_conditional_edges("adjudicate", _route("synthesize"), ["synthesize", END])
    graph.add_edge("synthesize", END)

    return graph.compile()


async def run_graph(graph, initial_state: VeritasState) -> VeritasState:
    """`compiled_graph.ainvoke()` returns a plain dict containing only the
    channels a node actually wrote during this run - fields untouched by
    every node (analysis_id, model_id, prompt_version, and error on the
    success path) are silently absent from it, not defaulted. Overlaying
    that dict onto the original input via model_copy gives back a
    complete, correctly-typed VeritasState."""
    updates = await graph.ainvoke(initial_state)
    return initial_state.model_copy(update=updates)

