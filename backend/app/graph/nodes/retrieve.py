"""Per scored claim, fan out to pgvector corpus (top-k) + web search
(top-k), dedup by URL then by near-duplicate embedding similarity, and tag
each surviving hit with a source_tier via the static domain allowlist.

In MOCK_MODE corpus_store is None - there is no seeded corpus in a fresh
offline run, so we honestly return no corpus hits rather than fabricating
them. MockSearchProvider still supplies "web" evidence deterministically.
"""
from __future__ import annotations

from app.providers.embeddings.base import EmbeddingProvider
from app.providers.search.base import SearchHit, WebSearchProvider
from app.retrieval.dedup import dedup_by_url, dedup_near_duplicates
from app.retrieval.pgvector_store import CorpusStore
from app.retrieval.source_tiers import tier_for_domain
from app.schemas.state import EvidenceDoc, VeritasState


def make_retrieve_node(
    search_provider: WebSearchProvider,
    embedding_provider: EmbeddingProvider,
    corpus_store: CorpusStore | None,
    top_k_corpus: int,
    top_k_web: int,
    dedup_threshold: float,
):
    async def retrieve_node(state: VeritasState) -> dict:
        all_evidence: list[EvidenceDoc] = []
        evidence_counter = 0

        for claim in state.claims:
            if not claim.scored:
                continue

            web_hits = await search_provider.search(claim.text, max_results=top_k_web)
            hits: list[SearchHit] = dedup_by_url(web_hits)
            hits = dedup_near_duplicates(hits, embedding_provider, threshold=dedup_threshold)

            claim_vector = embedding_provider.embed([claim.text])[0]
            hit_vectors = (
                embedding_provider.embed([f"{h.title} {h.snippet}" for h in hits]) if hits else []
            )

            for hit, hit_vector in zip(hits, hit_vectors, strict=True):
                evidence_counter += 1
                similarity = _cosine(claim_vector, hit_vector)
                all_evidence.append(
                    EvidenceDoc(
                        evidence_id=f"e{evidence_counter}",
                        claim_id=claim.claim_id,
                        url=hit.url,
                        domain=hit.domain,
                        source_tier=tier_for_domain(hit.domain),
                        text=hit.snippet,
                        similarity=round(max(0.0, min(1.0, similarity)), 3),
                        retrieved_from="web",
                    )
                )

            if corpus_store is not None:
                corpus_hits = await corpus_store.search(claim_vector, top_k=top_k_corpus)
                for hit in corpus_hits:
                    evidence_counter += 1
                    all_evidence.append(
                        EvidenceDoc(
                            evidence_id=f"e{evidence_counter}",
                            claim_id=claim.claim_id,
                            url=hit.url,
                            domain=hit.domain,
                            source_tier=tier_for_domain(hit.domain),
                            text=hit.text,
                            similarity=round(max(0.0, min(1.0, hit.similarity)), 3),
                            retrieved_from="corpus",
                        )
                    )

        return {"evidence": all_evidence}

    return retrieve_node


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
