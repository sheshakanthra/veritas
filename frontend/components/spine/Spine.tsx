"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { ClaimNode } from "@/components/spine/ClaimNode";
import { StanceBar } from "@/components/veritas/StanceBar";
import { computeSpineLayout } from "@/components/spine/layout";
import { cn } from "@/lib/utils";
import type { Claim, ClaimVerdict, EvidenceDoc, StanceResult } from "@/lib/types";

const SPINE_COLUMN_WIDTH_PX = 56;

interface SpineProps {
  claims: Claim[];
  claimVerdicts: ClaimVerdict[];
  stances: StanceResult[];
  evidence: EvidenceDoc[];
  className?: string;
}

/** Reads a matchMedia breakpoint as external browser state rather than
 * mirroring it into a useState+useEffect pair - useSyncExternalStore is
 * the tool built for exactly this ("subscribe to a value that lives
 * outside React"), and it avoids the extra render pass a setState-in-effect
 * would cause on mount. */
function useIsMobile(breakpointPx: number): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const query = window.matchMedia(`(max-width: ${breakpointPx}px)`);
      query.addEventListener("change", callback);
      return () => query.removeEventListener("change", callback);
    },
    [breakpointPx]
  );
  const getSnapshot = useCallback(
    () => window.matchMedia(`(max-width: ${breakpointPx}px)`).matches,
    [breakpointPx]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function Spine({ claims, claimVerdicts, stances, evidence, className }: SpineProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile(640);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const claimById = useMemo(() => new Map(claims.map((c) => [c.claim_id, c])), [claims]);
  const evidenceById = useMemo(() => new Map(evidence.map((e) => [e.evidence_id, e])), [evidence]);
  const stancesByClaim = useMemo(() => {
    const map = new Map<string, StanceResult[]>();
    for (const s of stances) {
      if (!map.has(s.claim_id)) map.set(s.claim_id, []);
      map.get(s.claim_id)!.push(s);
    }
    return map;
  }, [stances]);

  const { nodes, segments, totalHeight } = useMemo(
    () => computeSpineLayout(claimVerdicts),
    [claimVerdicts]
  );

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handleContainerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown" && activeIndex < claimVerdicts.length - 1) {
      e.preventDefault();
      const next = activeIndex + 1;
      setActiveIndex(next);
      rowRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp" && activeIndex > 0) {
      e.preventDefault();
      const prev = activeIndex - 1;
      setActiveIndex(prev);
      rowRefs.current[prev]?.focus();
    }
  }

  if (claimVerdicts.length === 0) return null;

  if (isMobile) {
    return (
      <div className={cn("flex flex-col gap-3", className)} role="list" aria-label="Claims and verdicts">
        {claimVerdicts.map((verdict, i) => {
          const claim = claimById.get(verdict.claim_id);
          if (!claim) return null;
          return (
            <div key={verdict.claim_id} className="relative overflow-hidden rounded-data border border-line bg-panel">
              <StanceBar verdict={verdict.verdict} />
              <ClaimNode
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                claim={claim}
                verdict={verdict}
                stances={stancesByClaim.get(verdict.claim_id) ?? []}
                evidenceById={evidenceById}
                isActive={activeIndex === i}
                onActivate={() => setActiveIndex(i)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative grid", className)}
      style={{ gridTemplateColumns: `${SPINE_COLUMN_WIDTH_PX}px 1fr` }}
      role="list"
      aria-label="Claims and verdicts"
      onKeyDown={handleContainerKeyDown}
    >
      <svg
        width={SPINE_COLUMN_WIDTH_PX}
        height={totalHeight}
        viewBox={`0 0 ${SPINE_COLUMN_WIDTH_PX} ${totalHeight}`}
        className="pointer-events-none"
        aria-hidden="true"
      >
        {segments.map((segment, i) => (
          <motion.path
            key={segment.claimId}
            d={segment.d}
            fill="none"
            stroke="var(--v-line)"
            strokeWidth={2}
            initial={prefersReducedMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.38,
              delay: prefersReducedMotion ? 0 : i * 0.04,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ))}
        {nodes.map((node, i) => {
          const verdict = claimVerdicts[i];
          const color = `var(--v-${verdict.verdict === "SUPPORTED" ? "supports" : verdict.verdict === "REFUTED" ? "refutes" : verdict.verdict === "MISLEADING_CONTEXT" ? "caution" : "neutral"})`;
          return (
            <motion.circle
              key={node.claimId}
              cx={node.x}
              cy={node.y}
              r={5}
              fill={color}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.22,
                delay: prefersReducedMotion ? 0 : i * 0.04 + 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          );
        })}
      </svg>

      <div className="flex flex-col divide-y divide-line border-x border-line">
        {claimVerdicts.map((verdict, i) => {
          const claim = claimById.get(verdict.claim_id);
          if (!claim) return null;
          return (
            <ClaimNode
              key={verdict.claim_id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              claim={claim}
              verdict={verdict}
              stances={stancesByClaim.get(verdict.claim_id) ?? []}
              evidenceById={evidenceById}
              isActive={activeIndex === i}
              onActivate={() => setActiveIndex(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
