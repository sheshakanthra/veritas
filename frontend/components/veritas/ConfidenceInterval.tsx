import { cn } from "@/lib/utils";

/**
 * Renders an interval and an evidence count - never a bare percentage,
 * never a gauge. Confidence is not the LLM's self-report; it's derived
 * from measurable evidence features in calibration.py, and this component
 * exists specifically so nobody downstream can flatten that into "87%".
 */
export function ConfidenceInterval({
  interval,
  evidenceCount,
  tier1Count,
  className,
}: {
  interval: [number, number];
  evidenceCount: number;
  tier1Count: number;
  className?: string;
}) {
  const [lower, upper] = interval;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-sm", className)}>
      <span className="text-text tabular-nums">
        {lower.toFixed(2)}–{upper.toFixed(2)}
      </span>
      <span className="text-mute" aria-hidden>
        ·
      </span>
      <span className="text-mute tabular-nums">
        {evidenceCount} source{evidenceCount === 1 ? "" : "s"}
      </span>
      {tier1Count > 0 && (
        <>
          <span className="text-mute" aria-hidden>
            ·
          </span>
          <span className="text-mute tabular-nums">
            {tier1Count} tier-1
          </span>
        </>
      )}
    </div>
  );
}
