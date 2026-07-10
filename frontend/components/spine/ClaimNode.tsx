"use client";

import { forwardRef, useRef } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { EvidenceTie } from "@/components/spine/EvidenceTie";
import { VerdictBadge } from "@/components/veritas/VerdictBadge";
import { ConfidenceInterval } from "@/components/veritas/ConfidenceInterval";
import { ROW_HEIGHT_PX } from "@/components/spine/layout";
import { cn } from "@/lib/utils";
import type { Claim, ClaimVerdict, EvidenceDoc, StanceResult } from "@/lib/types";

interface ClaimNodeProps {
  claim: Claim;
  verdict: ClaimVerdict;
  stances: StanceResult[];
  evidenceById: Map<string, EvidenceDoc>;
  isActive: boolean;
  onActivate: () => void;
}

export const ClaimNode = forwardRef<HTMLDivElement, ClaimNodeProps>(function ClaimNode(
  { claim, verdict, stances, evidenceById, isActive, onActivate }: ClaimNodeProps,
  ref
) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const tieRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tiesWithSpan = stances.filter((s) => s.span && evidenceById.has(s.evidence_id));

  function focusTie(index: number) {
    tieRefs.current[index]?.focus();
  }

  return (
    <div
      ref={ref}
      role="listitem"
      tabIndex={isActive ? 0 : -1}
      onFocus={onActivate}
      aria-label={`Claim: ${claim.text}. Verdict: ${verdict.verdict}.`}
      className={cn(
        "flex flex-col justify-center gap-2 border-b border-line px-4 py-3 outline-none",
        "focus-visible:bg-panel-raised/60"
      )}
      style={{ minHeight: ROW_HEIGHT_PX }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={verdict.verdict} />
        {!claim.scored && (
          <span className="text-mute font-mono text-xs uppercase tracking-wide">
            Opinion · not scored
          </span>
        )}
      </div>

      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="text-text font-mono text-base leading-snug"
      >
        {claim.text}
      </motion.p>

      {claim.scored && verdict.verdict !== "UNVERIFIABLE" && (
        <ConfidenceInterval
          interval={verdict.confidence_interval}
          evidenceCount={verdict.evidence_count}
          tier1Count={verdict.tier1_count}
        />
      )}

      {verdict.verdict === "UNVERIFIABLE" && claim.scored && (
        <p className="text-mute font-mono text-sm">
          Not enough evidence to rule either way
          {verdict.evidence_count === 0 ? " - no sources were found for this claim." : "."}
        </p>
      )}

      {tiesWithSpan.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1" role="group" aria-label="Evidence">
          {tiesWithSpan.map((stance, i) => {
            const evidence = evidenceById.get(stance.evidence_id)!;
            return (
              <EvidenceTie
                key={stance.evidence_id}
                ref={(el) => {
                  tieRefs.current[i] = el;
                }}
                stance={stance}
                evidence={evidence}
                index={i}
                totalTies={tiesWithSpan.length}
                onFocusTie={focusTie}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
