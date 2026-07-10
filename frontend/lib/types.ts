import { z } from "zod";

/**
 * Mirrors backend/app/schemas/{state,result}.py field-for-field. These
 * zod schemas are the validation boundary for SSE payloads - every event
 * off the wire is parsed through one of these before it touches state, so
 * a malformed or unexpected payload fails loudly instead of silently
 * propagating bad data into the Spine's geometry.
 */

export const VerdictSchema = z.enum([
  "SUPPORTED",
  "REFUTED",
  "MISLEADING_CONTEXT",
  "UNVERIFIABLE",
]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const ClaimTypeSchema = z.enum([
  "statistical",
  "causal",
  "attributive",
  "event",
  "opinion",
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const StanceSchema = z.enum(["SUPPORTS", "REFUTES", "NEUTRAL"]);
export type Stance = z.infer<typeof StanceSchema>;

export const SourceTierSchema = z.enum(["1", "2", "3"]);
export type SourceTier = z.infer<typeof SourceTierSchema>;

export const ClaimSchema = z.object({
  claim_id: z.string(),
  text: z.string(),
  claim_type: ClaimTypeSchema,
  scored: z.boolean(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const EvidenceDocSchema = z.object({
  evidence_id: z.string(),
  claim_id: z.string(),
  url: z.string(),
  domain: z.string(),
  source_tier: SourceTierSchema,
  text: z.string(),
  similarity: z.number().min(0).max(1),
  retrieved_from: z.enum(["corpus", "web"]),
});
export type EvidenceDoc = z.infer<typeof EvidenceDocSchema>;

export const StanceResultSchema = z.object({
  claim_id: z.string(),
  evidence_id: z.string(),
  stance: StanceSchema,
  stance_confidence: z.number().min(0).max(1),
  span: z.string().nullable(),
  rationale: z.string(),
});
export type StanceResult = z.infer<typeof StanceResultSchema>;

export const ClaimVerdictSchema = z.object({
  claim_id: z.string(),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  confidence_interval: z.tuple([z.number(), z.number()]),
  net_stance_weight: z.number().min(-1).max(1),
  evidence_count: z.number().int().min(0),
  tier1_count: z.number().int().min(0),
  supporting_evidence_ids: z.array(z.string()),
  refuting_evidence_ids: z.array(z.string()),
  reason_code: z.string(),
});
export type ClaimVerdict = z.infer<typeof ClaimVerdictSchema>;

export const TraceEventSchema = z.object({
  node: z.string(),
  status: z.enum(["pending", "running", "done", "error"]),
  latency_ms: z.number().nullable(),
  token_count: z.number().nullable(),
  cache_hit: z.boolean(),
  error: z.string().nullable(),
  timestamp: z.string(),
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;

export const AnalysisResultSchema = z.object({
  analysis_id: z.string(),
  input_text: z.string(),
  input_type: z.string(),
  created_at: z.string(),
  claims: z.array(ClaimSchema),
  evidence: z.array(EvidenceDocSchema),
  stances: z.array(StanceResultSchema),
  claim_verdicts: z.array(ClaimVerdictSchema),
  overall_verdict: VerdictSchema,
  overall_confidence: z.number().min(0).max(1),
  explanation: z.string(),
  trace: z.array(TraceEventSchema),
  cache_hit: z.boolean(),
  cache_key: z.string(),
  prompt_version: z.string(),
  model_id: z.string(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const VeritasErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  node: z.string(),
  retryable: z.boolean(),
});
export type VeritasError = z.infer<typeof VeritasErrorSchema>;
