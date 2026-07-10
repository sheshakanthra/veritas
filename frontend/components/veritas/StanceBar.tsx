import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

const VERDICT_COLOR_VAR: Record<Verdict, string> = {
  SUPPORTED: "var(--v-supports)",
  REFUTED: "var(--v-refutes)",
  MISLEADING_CONTEXT: "var(--v-caution)",
  UNVERIFIABLE: "var(--v-mute)",
};

/** Mobile (<=640px) replacement for the Spine's per-node deflection: a
 * left-edge color bar on each stacked claim card. The spine does not
 * squash into a tiny SVG on small screens - it becomes this instead. */
export function StanceBar({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0 w-1 rounded-l-data", className)}
      style={{ backgroundColor: VERDICT_COLOR_VAR[verdict] }}
    />
  );
}
