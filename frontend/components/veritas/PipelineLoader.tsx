"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { Eyebrow } from "@/components/veritas/primitives";
import { cn } from "@/lib/utils";
import type { TraceEvent } from "@/lib/types";

type Status = "pending" | "running" | "done" | "error";

const STAGES: { key: string; title: string; body: string }[] = [
  { key: "ingest", title: "Reading the input", body: "Detecting type and extracting text" },
  { key: "decompose", title: "Breaking into claims", body: "Isolating individually checkable statements" },
  { key: "retrieve", title: "Gathering evidence", body: "Searching sources and de-duplicating" },
  { key: "stance", title: "Weighing each source", body: "Supports, refutes, or neutral — with a quote" },
  { key: "adjudicate", title: "Reconciling the evidence", body: "Applying the verdict rule table" },
  { key: "synthesize", title: "Writing the verdict", body: "Grounded only in retained quotes" },
];

export function PipelineLoader({ events }: { events: TraceEvent[] }) {
  const reduce = usePrefersReducedMotion();
  const byNode = useMemo(() => new Map(events.map((e) => [e.node, e])), [events]);

  const statuses = STAGES.map((s) => (byNode.get(s.key)?.status ?? "pending") as Status);
  const doneCount = statuses.filter((s) => s === "done").length;
  const runningIndex = statuses.findIndex((s) => s === "running");
  const activeTitle =
    runningIndex >= 0
      ? STAGES[runningIndex].title
      : doneCount === STAGES.length
        ? "Finishing up"
        : STAGES[Math.min(doneCount, STAGES.length - 1)].title;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-24">
      <Eyebrow className="mb-4">Analysis in progress</Eyebrow>
      <h1 className="text-text text-2xl font-semibold tracking-tight">Investigating the claim</h1>
      <p className="text-mute mt-2 font-mono text-sm">
        {activeTitle}
        {!reduce && <AnimatedEllipsis />}
      </p>

      <ol className="relative mt-10 flex flex-col">
        {/* rail */}
        <span aria-hidden className="bg-line absolute top-2 bottom-2 left-[11px] w-px" />
        <motion.span
          aria-hidden
          className="bg-signal absolute left-[11px] w-px"
          style={{ top: 8 }}
          initial={false}
          animate={{ height: `calc(${(doneCount / STAGES.length) * 100}% - 16px)` }}
          transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        />

        {STAGES.map((stage, i) => {
          const status = statuses[i];
          const event = byNode.get(stage.key);
          return (
            <motion.li
              key={stage.key}
              initial={reduce ? false : { opacity: 0, x: 6 }}
              animate={{ opacity: status === "pending" ? 0.55 : 1, x: 0 }}
              transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : i * 0.06 }}
              className="relative z-10 flex items-start gap-4 py-3"
            >
              <StageMarker status={status} reduce={reduce} />
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      status === "pending" ? "text-mute" : "text-text"
                    )}
                  >
                    {stage.title}
                  </span>
                  <span className="text-mute shrink-0 font-mono text-xs tabular-nums">
                    {status === "done" && event?.latency_ms != null && `${event.latency_ms}ms`}
                    {status === "running" && "running"}
                    {status === "error" && <span className="text-refutes">error</span>}
                  </span>
                </div>
                <p className="text-mute mt-0.5 text-xs">{stage.body}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </main>
  );
}

function StageMarker({ status, reduce }: { status: Status; reduce: boolean }) {
  const base = "relative flex size-6 shrink-0 items-center justify-center rounded-full border";
  if (status === "done") {
    return (
      <span className={cn(base, "border-signal bg-signal/15 text-signal")}>
        <Check className="size-3.5" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn(base, "border-refutes bg-refutes/15 text-refutes")}>
        <X className="size-3.5" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className={cn(base, "border-signal bg-void")}>
        {!reduce && (
          <motion.span
            className="border-signal absolute inset-0 rounded-full border"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className="bg-signal size-2 rounded-full" />
      </span>
    );
  }
  return (
    <span className={cn(base, "border-line bg-void")}>
      <span className="bg-mute/50 size-1.5 rounded-full" />
    </span>
  );
}

function AnimatedEllipsis() {
  return (
    <motion.span
      className="ml-0.5 inline-block"
      aria-hidden
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    >
      …
    </motion.span>
  );
}
