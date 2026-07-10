import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

const VERDICT_LABEL: Record<Verdict, string> = {
  SUPPORTED: "Supported",
  REFUTED: "Refuted",
  MISLEADING_CONTEXT: "Missing context",
  UNVERIFIABLE: "Unverifiable",
};

const VERDICT_COLOR_VAR: Record<Verdict, string> = {
  SUPPORTED: "var(--v-supports)",
  REFUTED: "var(--v-refutes)",
  MISLEADING_CONTEXT: "var(--v-caution)",
  UNVERIFIABLE: "var(--v-mute)",
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const color = VERDICT_COLOR_VAR[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-data border px-2 py-0.5",
        "font-mono text-xs uppercase tracking-wide",
        className
      )}
      style={{ borderColor: color, color }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
