"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertOctagon, Check, Copy, Download, Flag } from "lucide-react";
import { Spine } from "@/components/spine/Spine";
import { VerdictHero } from "@/components/veritas/VerdictHero";
import { EvidenceList } from "@/components/veritas/EvidenceCard";
import { ExecutionTrace } from "@/components/veritas/ExecutionTrace";
import { PipelineLoader } from "@/components/veritas/PipelineLoader";
import { Eyebrow, Panel } from "@/components/veritas/primitives";
import { subscribeToAnalysis } from "@/lib/sse";
import { cn } from "@/lib/utils";
import type { AnalysisResult, TraceEvent, VeritasError } from "@/lib/types";

/**
 * Rendered with `key={id}` by the route, so navigating between analyses
 * remounts a fresh instance rather than resetting state on prop change.
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

  if (streamError) return <ErrorState error={streamError} />;
  if (!result) return <PipelineLoader events={events} />;

  return <AnalysisWorkspace result={result} />;
}

function AnalysisWorkspace({ result }: { result: AnalysisResult }) {
  const derived = useMemo(() => {
    const interval: [number, number] =
      result.claim_verdicts.length > 0
        ? [
            Math.min(...result.claim_verdicts.map((c) => c.confidence_interval[0])),
            Math.max(...result.claim_verdicts.map((c) => c.confidence_interval[1])),
          ]
        : [0, 0];

    const nonNeutral = result.stances.filter((s) => s.stance !== "NEUTRAL");
    const supports = nonNeutral.filter((s) => s.stance === "SUPPORTS").length;
    const refutes = nonNeutral.length - supports;
    const agreement = nonNeutral.length > 0 ? Math.max(supports, refutes) / nonNeutral.length : null;

    return {
      interval,
      agreement,
      evidenceCount: result.evidence.length,
      tier1Count: result.evidence.filter((e) => e.source_tier === "1").length,
      claimsScored: result.claims.filter((c) => c.scored).length,
      claimsTotal: result.claims.length,
    };
  }, [result]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <VerdictHero
        verdict={result.overall_verdict}
        confidence={result.overall_confidence}
        interval={derived.interval}
        claimsScored={derived.claimsScored}
        claimsTotal={derived.claimsTotal}
        evidenceCount={derived.evidenceCount}
        tier1Count={derived.tier1Count}
        agreement={derived.agreement}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-10">
          <section aria-label="Claim decomposition">
            <div className="mb-4 flex items-center justify-between">
              <Eyebrow>Claim decomposition</Eyebrow>
              <span className="text-mute font-mono text-xs tabular-nums">
                {derived.claimsTotal} claim{derived.claimsTotal === 1 ? "" : "s"}
              </span>
            </div>
            <Spine
              claims={result.claims}
              claimVerdicts={result.claim_verdicts}
              stances={result.stances}
              evidence={result.evidence}
            />
          </section>

          <section aria-label="Evidence">
            <EvidenceList stances={result.stances} evidence={result.evidence} claims={result.claims} />
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
          <Panel className="p-5">
            <Eyebrow className="mb-3">Explanation</Eyebrow>
            <p className="text-text font-sans text-base leading-relaxed">{result.explanation}</p>
          </Panel>

          <MetadataPanel result={result} />

          <Panel className="p-5">
            <Eyebrow className="mb-3">Execution</Eyebrow>
            <ExecutionTrace trace={result.trace} />
          </Panel>

          <ActionsPanel result={result} />
        </aside>
      </div>
    </main>
  );
}

function MetadataPanel({ result }: { result: AnalysisResult }) {
  const rows: { label: string; value: string }[] = [
    { label: "Model", value: result.model_id },
    { label: "Prompt", value: result.prompt_version },
    { label: "Input", value: result.input_type },
    { label: "Cache", value: result.cache_hit ? "Cache hit" : "Fresh run" },
    { label: "ID", value: result.analysis_id.slice(0, 8) },
  ];
  return (
    <Panel className="p-5">
      <Eyebrow className="mb-3">Metadata</Eyebrow>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="border-line/60 flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
            <dt className="text-mute font-mono text-xs tracking-wide uppercase">{row.label}</dt>
            <dd className="text-text-2 truncate font-mono text-xs tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function ActionsPanel({ result }: { result: AnalysisResult }) {
  const [copied, setCopied] = useState(false);

  function exportJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veritas-${result.analysis_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported as JSON");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function report() {
    const summary = `VERITAS analysis ${result.analysis_id}\nVerdict: ${result.overall_verdict}\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Report details copied — paste into your issue tracker");
    } catch {
      toast.error("Couldn't copy the report details");
    }
  }

  const actions = [
    { label: "Export JSON", icon: Download, onClick: exportJson },
    { label: copied ? "Copied" : "Copy link", icon: copied ? Check : Copy, onClick: copyLink },
    { label: "Report issue", icon: Flag, onClick: report },
  ];

  return (
    <Panel className="p-2">
      <div className="flex flex-col">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="text-text-2 hover:bg-panel-hover hover:text-text flex items-center gap-3 rounded-data px-3 py-2.5 text-left text-sm transition-colors"
            >
              <Icon className="text-mute size-4" />
              {a.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function ErrorState({ error }: { error: VeritasError | { message: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="text-refutes border-refutes/40 bg-refutes/10 mb-5 inline-flex size-11 items-center justify-center rounded-card border">
          <AlertOctagon className="size-5" />
        </span>
        <h1 className="text-text text-2xl font-semibold tracking-tight">Analysis interrupted</h1>
        <p className={cn("text-text-2 mt-3 text-base leading-relaxed")}>{error.message}</p>
        <Link
          href="/"
          className="text-signal mt-6 inline-flex font-mono text-sm tracking-wide uppercase transition-colors hover:brightness-110"
        >
          ← Start over
        </Link>
      </motion.div>
    </main>
  );
}
