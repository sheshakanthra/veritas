"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import type { TraceEvent } from "@/lib/types";

const NODE_LABEL: Record<string, string> = {
  ingest: "ingest",
  decompose: "decompose",
  retrieve: "retrieve",
  stance: "stance",
  adjudicate: "adjudicate",
  synthesize: "synthesize",
};

const PIPELINE_NODES = ["ingest", "decompose", "retrieve", "stance", "adjudicate", "synthesize"];

interface RunLogProps {
  events: TraceEvent[];
  className?: string;
}

/**
 * "Each agent node is a row that resolves from pending -> running -> done
 * (142ms - 318 tok)." The pending state is a hairline shimmer, never a
 * spinner - the user watches the graph execute, not a generic loader.
 */
export function RunLog({ events, className }: RunLogProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const eventByNode = new Map(events.map((e) => [e.node, e]));

  return (
    <div
      className={cn("flex flex-col divide-y divide-line border border-line rounded-data", className)}
      role="log"
      aria-live="polite"
      aria-label="Analysis pipeline progress"
    >
      {PIPELINE_NODES.map((node) => {
        const event = eventByNode.get(node);
        const status = event?.status ?? "pending";
        return (
          <div key={node} className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-sm">
            <div className="flex items-center gap-2">
              <StatusDot status={status} reduceMotion={!!prefersReducedMotion} />
              <span className={cn("uppercase tracking-wide", status === "pending" ? "text-mute" : "text-text")}>
                {NODE_LABEL[node] ?? node}
              </span>
            </div>
            <div className="text-mute flex items-center gap-2 tabular-nums">
              {status === "done" && event && (
                <>
                  <span>{event.latency_ms}ms</span>
                  {event.token_count != null && <span>· {event.token_count} tok</span>}
                  {event.cache_hit && (
                    <span className="text-signal font-semibold uppercase tracking-wide">· cached</span>
                  )}
                </>
              )}
              {status === "error" && <span className="text-refutes">error</span>}
              {status === "pending" && !prefersReducedMotion && (
                <ShimmerBar />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusDot({ status, reduceMotion }: { status: string; reduceMotion: boolean }) {
  if (status === "done") {
    return <span className="bg-signal size-1.5 rounded-full" aria-hidden />;
  }
  if (status === "error") {
    return <span className="bg-refutes size-1.5 rounded-full" aria-hidden />;
  }
  if (status === "running" && !reduceMotion) {
    return (
      <motion.span
        className="bg-signal size-1.5 rounded-full"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
    );
  }
  return <span className="border-mute size-1.5 rounded-full border" aria-hidden />;
}

function ShimmerBar() {
  return (
    <span className="relative h-2 w-16 overflow-hidden rounded-data bg-line" aria-hidden>
      <motion.span
        className="absolute inset-y-0 left-0 w-1/2 bg-mute/40"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
    </span>
  );
}
