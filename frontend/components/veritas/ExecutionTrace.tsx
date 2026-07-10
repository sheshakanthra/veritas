import { cn } from "@/lib/utils";
import type { TraceEvent } from "@/lib/types";

const NODE_TITLE: Record<string, string> = {
  ingest: "Read",
  decompose: "Decompose",
  retrieve: "Retrieve",
  stance: "Weigh",
  adjudicate: "Adjudicate",
  synthesize: "Explain",
};

/** The pipeline's execution, as a compact timeline: each node with its
 * measured latency and token count. This is the receipt for how the
 * verdict was produced. */
export function ExecutionTrace({ trace, className }: { trace: TraceEvent[]; className?: string }) {
  const totalMs = trace.reduce((sum, e) => sum + (e.latency_ms ?? 0), 0);

  return (
    <div className={cn("flex flex-col", className)}>
      <ol className="relative flex flex-col">
        <span aria-hidden className="bg-line absolute top-2 bottom-2 left-[3px] w-px" />
        {trace.map((event) => {
          const isError = event.status === "error";
          return (
            <li key={event.node} className="relative flex items-center gap-3 py-1.5">
              <span
                aria-hidden
                className={cn(
                  "z-10 size-1.5 shrink-0 rounded-full",
                  isError ? "bg-refutes" : "bg-signal"
                )}
              />
              <span className={cn("flex-1 font-mono text-xs", isError ? "text-refutes" : "text-text-2")}>
                {NODE_TITLE[event.node] ?? event.node}
              </span>
              <span className="text-mute flex items-center gap-2 font-mono text-xs tabular-nums">
                {event.latency_ms != null && <span>{event.latency_ms}ms</span>}
                {event.token_count != null && <span className="text-mute/70">{event.token_count}t</span>}
                {event.cache_hit && <span className="text-signal">cached</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="border-line text-mute mt-2 flex items-center justify-between border-t pt-2 font-mono text-xs">
        <span className="tracking-wide uppercase">Total</span>
        <span className="text-text tabular-nums">{totalMs}ms</span>
      </div>
    </div>
  );
}
