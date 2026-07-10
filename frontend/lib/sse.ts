import {
  AnalysisResultSchema,
  TraceEventSchema,
  VeritasErrorSchema,
  type AnalysisResult,
  type TraceEvent,
  type VeritasError,
} from "@/lib/types";

export interface AnalysisStreamHandlers {
  onNode: (event: TraceEvent) => void;
  onResult: (result: AnalysisResult) => void;
  onError: (error: VeritasError | { message: string }) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Opens the SSE stream for one analysis and validates every payload
 * through the zod schemas in lib/types.ts before handing it to a caller.
 * A payload that doesn't match the expected shape is reported via
 * onError rather than silently reaching component state - the Spine's
 * geometry is only ever built from data that passed this gate.
 */
export function subscribeToAnalysis(
  analysisId: string,
  handlers: AnalysisStreamHandlers
): () => void {
  const source = new EventSource(`${API_BASE_URL}/api/v1/analyze/${analysisId}/stream`);

  source.addEventListener("node", (event) => {
    const parsed = safeParseEventData(event.data);
    const result = TraceEventSchema.safeParse(parsed);
    if (result.success) {
      handlers.onNode(result.data);
    } else {
      handlers.onError({ message: `Malformed node event: ${result.error.message}` });
    }
  });

  source.addEventListener("result", (event) => {
    const parsed = safeParseEventData(event.data);
    const result = AnalysisResultSchema.safeParse(parsed);
    if (result.success) {
      handlers.onResult(result.data);
      source.close();
    } else {
      handlers.onError({ message: `Malformed result event: ${result.error.message}` });
    }
  });

  source.addEventListener("error", (event) => {
    const messageEvent = event as MessageEvent<string>;
    if (messageEvent.data) {
      const parsed = safeParseEventData(messageEvent.data);
      const result = VeritasErrorSchema.safeParse(parsed);
      handlers.onError(result.success ? result.data : { message: "Connection to the analysis stream was lost." });
    } else {
      handlers.onError({ message: "Connection to the analysis stream was lost." });
    }
    source.close();
  });

  return () => source.close();
}

function safeParseEventData(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
