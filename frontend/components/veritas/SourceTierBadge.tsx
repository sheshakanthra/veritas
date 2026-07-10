import { cn } from "@/lib/utils";
import type { SourceTier } from "@/lib/types";

const TIER_LABEL: Record<SourceTier, string> = {
  "1": "Tier 1 · Wire / primary",
  "2": "Tier 2 · Established outlet",
  "3": "Tier 3 · Unverified source",
};

const TIER_SHORT_LABEL: Record<SourceTier, string> = {
  "1": "T1",
  "2": "T2",
  "3": "T3",
};

export function SourceTierBadge({
  tier,
  className,
  full = false,
}: {
  tier: SourceTier;
  className?: string;
  full?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-data border border-line px-1.5 py-0.5",
        "font-mono text-xs text-mute",
        className
      )}
      title={TIER_LABEL[tier]}
    >
      {full ? TIER_LABEL[tier] : TIER_SHORT_LABEL[tier]}
    </span>
  );
}
