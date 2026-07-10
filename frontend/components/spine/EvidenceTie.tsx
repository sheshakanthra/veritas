"use client";

import { forwardRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SourceTierBadge } from "@/components/veritas/SourceTierBadge";
import { cn } from "@/lib/utils";
import { tieColorVarForStance, tieLengthForSimilarity, tieOpacityForTier } from "@/components/spine/tie-geometry";
import type { EvidenceDoc, StanceResult } from "@/lib/types";

interface EvidenceTieProps {
  stance: StanceResult;
  evidence: EvidenceDoc;
  index: number;
  totalTies: number;
  onFocusTie: (index: number) => void;
}

/**
 * One evidence branch off a claim node. The stub's width, opacity, and
 * color are pure functions of the evidence data (tie-geometry.ts) - never
 * hand-tuned per row. Hover/focus opens a frosted popover with the
 * verbatim span; this is the one place glass is meaningful in the whole
 * app, because it's a lens over evidence, not decoration.
 */
export const EvidenceTie = forwardRef<HTMLButtonElement, EvidenceTieProps>(function EvidenceTie(
  { stance, evidence, index, totalTies, onFocusTie }: EvidenceTieProps,
  ref
) {
  const length = tieLengthForSimilarity(evidence.similarity);
  const opacity = tieOpacityForTier(evidence.source_tier);
  const color = tieColorVarForStance(stance.stance);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowRight" && index < totalTies - 1) {
      e.preventDefault();
      onFocusTie(index + 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      onFocusTie(index - 1);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        ref={ref}
        onKeyDown={handleKeyDown}
        aria-label={`Evidence from ${evidence.domain}, ${stance.stance.toLowerCase()}`}
        className={cn(
          "group relative flex h-4 items-center focus-visible:outline-none",
          "data-[popup-open]:z-10"
        )}
        style={{ width: length }}
      >
        <span
          aria-hidden
          className="h-px w-full transition-[height] duration-hover group-hover:h-0.5 group-focus-visible:h-0.5"
          style={{ backgroundColor: color, opacity }}
        />
        <span
          aria-hidden
          className="absolute -right-0.5 size-1.5 rounded-full"
          style={{ backgroundColor: color, opacity }}
        />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-80 rounded-overlay border-line bg-panel-raised/90 p-3 font-mono text-sm shadow-[var(--v-popover-shadow)] backdrop-blur-md"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-mute text-xs uppercase tracking-wide">{stance.stance}</span>
          <SourceTierBadge tier={evidence.source_tier} />
        </div>
        <p className="text-text leading-relaxed">&ldquo;{stance.span ?? "(no verbatim span)"}&rdquo;</p>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
          <span className="text-mute truncate text-xs">{evidence.domain}</span>
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal shrink-0 text-xs underline underline-offset-2 hover:no-underline"
          >
            Open source
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
});
