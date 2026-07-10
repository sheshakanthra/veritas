import type { AnalysisResult } from "@/lib/types";

/**
 * One fixture exercising all four verdict shapes at once - used to build
 * and review the static Spine before wiring it to live SSE data (build
 * order phase 7: "get the visual right before it moves").
 */
export const FOUR_VERDICTS_FIXTURE: AnalysisResult = {
  analysis_id: "fixture-0000-0000-0000-000000000000",
  input_text:
    "The city council approved a $42 million transit budget. The new line caused a 30% drop in commute times. Officials said the project would finish by 2026. Critics called the plan the worst use of public money in a decade.",
  input_type: "claim",
  created_at: new Date().toISOString(),
  claims: [
    { claim_id: "c1", text: "The city council approved a $42 million transit budget.", claim_type: "statistical", scored: true },
    { claim_id: "c2", text: "The new line caused a 30% drop in commute times.", claim_type: "causal", scored: true },
    { claim_id: "c3", text: "Officials said the project would finish by 2026.", claim_type: "attributive", scored: true },
    { claim_id: "c4", text: "Critics called the plan the worst use of public money in a decade.", claim_type: "opinion", scored: false },
  ],
  evidence: [
    { evidence_id: "e1", claim_id: "c1", url: "https://reuters.com/a1", domain: "reuters.com", source_tier: "1", text: "The council approved a $42 million budget for the transit line in a unanimous vote.", similarity: 0.93, retrieved_from: "web" },
    { evidence_id: "e2", claim_id: "c1", url: "https://apnews.com/a2", domain: "apnews.com", source_tier: "1", text: "Records confirm the $42 million allocation for the downtown transit project.", similarity: 0.88, retrieved_from: "web" },
    { evidence_id: "e3", claim_id: "c2", url: "https://dailybuzzwire.net/a3", domain: "dailybuzzwire.net", source_tier: "3", text: "Officials denied that the line caused any measurable change in commute times.", similarity: 0.61, retrieved_from: "web" },
    { evidence_id: "e4", claim_id: "c3", url: "https://nytimes.com/a4", domain: "nytimes.com", source_tier: "2", text: "The mayor's office said the project would be completed by late 2026.", similarity: 0.79, retrieved_from: "web" },
    { evidence_id: "e5", claim_id: "c3", url: "https://bbc.com/a5", domain: "bbc.com", source_tier: "2", text: "Internal planning documents describe a 2028 completion target, contradicting public statements.", similarity: 0.74, retrieved_from: "web" },
  ],
  stances: [
    { claim_id: "c1", evidence_id: "e1", stance: "SUPPORTS", stance_confidence: 0.95, span: "The council approved a $42 million budget for the transit line in a unanimous vote.", rationale: "Direct match." },
    { claim_id: "c1", evidence_id: "e2", stance: "SUPPORTS", stance_confidence: 0.9, span: "Records confirm the $42 million allocation for the downtown transit project.", rationale: "Corroborating record." },
    { claim_id: "c2", evidence_id: "e3", stance: "REFUTES", stance_confidence: 0.7, span: "Officials denied that the line caused any measurable change in commute times.", rationale: "Direct denial." },
    { claim_id: "c3", evidence_id: "e4", stance: "SUPPORTS", stance_confidence: 0.8, span: "The mayor's office said the project would be completed by late 2026.", rationale: "Matches claim." },
    { claim_id: "c3", evidence_id: "e5", stance: "REFUTES", stance_confidence: 0.75, span: "Internal planning documents describe a 2028 completion target, contradicting public statements.", rationale: "Contradicts claim." },
  ],
  claim_verdicts: [
    { claim_id: "c1", verdict: "SUPPORTED", confidence: 0.88, confidence_interval: [0.74, 0.97], net_stance_weight: 1.0, evidence_count: 2, tier1_count: 2, supporting_evidence_ids: ["e1", "e2"], refuting_evidence_ids: [], reason_code: "support_majority" },
    { claim_id: "c2", verdict: "REFUTED", confidence: 0.42, confidence_interval: [0.18, 0.66], net_stance_weight: -1.0, evidence_count: 1, tier1_count: 0, supporting_evidence_ids: [], refuting_evidence_ids: ["e3"], reason_code: "refute_majority" },
    { claim_id: "c3", verdict: "MISLEADING_CONTEXT", confidence: 0.55, confidence_interval: [0.35, 0.75], net_stance_weight: 0.03, evidence_count: 2, tier1_count: 0, supporting_evidence_ids: ["e4"], refuting_evidence_ids: ["e5"], reason_code: "mixed_evidence" },
    { claim_id: "c4", verdict: "UNVERIFIABLE", confidence: 0.0, confidence_interval: [0.0, 0.0], net_stance_weight: 0.0, evidence_count: 0, tier1_count: 0, supporting_evidence_ids: [], refuting_evidence_ids: [], reason_code: "opinion_excluded" },
  ],
  overall_verdict: "REFUTED",
  overall_confidence: 0.42,
  explanation:
    'Of 3 scored claims examined, 1 supported, 1 refuted, 1 flagged as missing context. The strongest evidence states: "The council approved a $42 million budget for the transit line in a unanimous vote."',
  trace: [
    { node: "ingest", status: "done", latency_ms: 12, token_count: null, cache_hit: false, error: null, timestamp: new Date().toISOString() },
    { node: "decompose", status: "done", latency_ms: 340, token_count: 210, cache_hit: false, error: null, timestamp: new Date().toISOString() },
    { node: "retrieve", status: "done", latency_ms: 480, token_count: null, cache_hit: false, error: null, timestamp: new Date().toISOString() },
    { node: "stance", status: "done", latency_ms: 610, token_count: 890, cache_hit: false, error: null, timestamp: new Date().toISOString() },
    { node: "adjudicate", status: "done", latency_ms: 4, token_count: null, cache_hit: false, error: null, timestamp: new Date().toISOString() },
    { node: "synthesize", status: "done", latency_ms: 290, token_count: 140, cache_hit: false, error: null, timestamp: new Date().toISOString() },
  ],
  cache_hit: false,
  cache_key: "fixture-cache-key",
  prompt_version: "v1",
  model_id: "llama-3.3-70b-versatile",
};

function withSingleClaim(
  verdict: AnalysisResult["claim_verdicts"][number]["verdict"]
): AnalysisResult {
  const base = FOUR_VERDICTS_FIXTURE;
  const cv = base.claim_verdicts.find((c) => c.verdict === verdict) ?? base.claim_verdicts[0];
  const claim = base.claims.find((c) => c.claim_id === cv.claim_id)!;
  return {
    ...base,
    claims: [claim],
    claim_verdicts: [cv],
    evidence: base.evidence.filter((e) => e.claim_id === cv.claim_id),
    stances: base.stances.filter((s) => s.claim_id === cv.claim_id),
    overall_verdict: verdict,
  };
}

export const SUPPORTED_FIXTURE = withSingleClaim("SUPPORTED");
export const REFUTED_FIXTURE = withSingleClaim("REFUTED");
export const MISLEADING_CONTEXT_FIXTURE = withSingleClaim("MISLEADING_CONTEXT");
export const UNVERIFIABLE_FIXTURE = withSingleClaim("UNVERIFIABLE");
