"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RunLog } from "@/components/run-log/RunLog";
import { Spine } from "@/components/spine/Spine";
import { VerdictBadge } from "@/components/veritas/VerdictBadge";
import { ConfidenceInterval } from "@/components/veritas/ConfidenceInterval";
import { subscribeToAnalysis } from "@/lib/sse";
import type { AnalysisResult, TraceEvent, VeritasError } from "@/lib/types";

/**
 * The route (app/analyze/[id]/page.tsx) renders this with `key={id}`, so
 * a navigation between two analyses remounts a fresh instance instead of
 * needing an effect that resets state on prop change - React's own
 * recommended pattern for "this state belongs to a different identity now"
 * (react.dev/learn/you-might-not-need-an-effect).
 */
export function AnalysisView({ analysisId }: { analysisId: string }) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [streamError, setStreamError] = useState<VeritasError | { message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAnalysis(analysisId, {
      onNode: (event) => setEvents((prev) => [...prev.filter((e) => e.node !== event.node), event]),
      onResult: (analysisResult) => setResult(analysisResult),
      onError: (error) => setStreamError(error),
    });
    return unsubscribe;
  }, [analysisId]);

  if (streamError) {
    return <ErrorState error={streamError} />;
  }

  if (!result) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
        <h2 className="text-mute mb-4 font-mono text-sm uppercase tracking-wide">
          Running analysis
        </h2>
        <RunLog events={events} />
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 px-6 py-12 lg:grid-cols-[62fr_38fr]">
      <section className="flex flex-col gap-6" aria-label="Claims and evidence">
        <header className="flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={result.overall_verdict} className="text-base" />
          <ConfidenceInterval
            interval={
              result.claim_verdicts.length > 0
                ? [
                    Math.min(...result.claim_verdicts.map((c) => c.confidence_interval[0])),
                    Math.max(...result.claim_verdicts.map((c) => c.confidence_interval[1])),
                  ]
                : [0, 0]
            }
            evidenceCount={result.evidence.length}
            tier1Count={result.evidence.filter((e) => e.source_tier === "1").length}
          />
        </header>

        <Spine
          claims={result.claims}
          claimVerdicts={result.claim_verdicts}
          stances={result.stances}
          evidence={result.evidence}
        />
      </section>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-12 lg:self-start">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-overlay border border-line bg-panel p-5"
        >
          <h2 className="text-mute mb-3 font-mono text-xs uppercase tracking-wide">Explanation</h2>
          <p className="text-text font-sans text-base leading-relaxed">{result.explanation}</p>
        </motion.div>

        <div className="border-line rounded-data border">
          <h2 className="text-mute border-line border-b px-3 py-2 font-mono text-xs uppercase tracking-wide">
            Run log{result.cache_hit && <span className="text-signal ml-2">· cached</span>}
          </h2>
          <RunLog events={result.trace} className="rounded-none border-none" />
        </div>
      </aside>
    </main>
  );
}

function ErrorState({ error }: { error: VeritasError | { message: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-6 py-24">
      <span className="text-refutes mb-3 font-mono text-xs uppercase tracking-wide">Error</span>
      <p className="text-text font-mono text-lg leading-relaxed">{error.message}</p>
    </main>
  );
}
