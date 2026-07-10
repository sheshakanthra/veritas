"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, ExternalLink } from "lucide-react";
import { SourceTierBadge } from "@/components/veritas/SourceTierBadge";
import { Eyebrow, Panel } from "@/components/veritas/primitives";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import type { Claim, EvidenceDoc, Stance, StanceResult } from "@/lib/types";

const STANCE_META: Record<Stance, { label: string; colorVar: string }> = {
  SUPPORTS: { label: "Supports", colorVar: "var(--v-supports)" },
  REFUTES: { label: "Refutes", colorVar: "var(--v-refutes)" },
  NEUTRAL: { label: "Neutral", colorVar: "var(--v-neutral)" },
};

interface Row {
  stance: StanceResult;
  evidence: EvidenceDoc;
  claimText: string;
}

/** Evidence, presented as source cards. Built from the stance results that
 * carry a verbatim span, joined to their evidence doc - the same join the
 * spine ties use, surfaced here as a browsable list. */
export function EvidenceList({
  stances,
  evidence,
  claims,
}: {
  stances: StanceResult[];
  evidence: EvidenceDoc[];
  claims: Claim[];
}) {
  const rows = useMemo<Row[]>(() => {
    const evidenceById = new Map(evidence.map((e) => [e.evidence_id, e]));
    const claimById = new Map(claims.map((c) => [c.claim_id, c]));
    const tierRank: Record<string, number> = { "1": 0, "2": 1, "3": 2 };
    return stances
      .filter((s) => s.span && evidenceById.has(s.evidence_id))
      .map((s) => ({
        stance: s,
        evidence: evidenceById.get(s.evidence_id)!,
        claimText: claimById.get(s.claim_id)?.text ?? "",
      }))
      .sort(
        (a, b) =>
          tierRank[a.evidence.source_tier] - tierRank[b.evidence.source_tier] ||
          b.evidence.similarity - a.evidence.similarity
      );
  }, [stances, evidence, claims]);

  if (rows.length === 0) {
    return (
      <Panel className="p-6">
        <p className="text-mute text-sm">
          No source carried a verbatim span for this analysis. Evidence with a quoted passage appears
          here as browsable cards.
        </p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Eyebrow>Evidence</Eyebrow>
        <span className="text-mute font-mono text-xs tabular-nums">
          {rows.length} quoted source{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <EvidenceCard key={`${row.stance.evidence_id}-${row.stance.claim_id}`} row={row} index={i} />
        ))}
      </div>
    </div>
  );
}

function EvidenceCard({ row, index }: { row: Row; index: number }) {
  const reduce = usePrefersReducedMotion();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { stance, evidence, claimText } = row;
  const meta = STANCE_META[stance.stance];
  const span = stance.span ?? "";
  const isLong = span.length > 180;

  async function copySpan() {
    try {
      await navigator.clipboard.writeText(span);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked - no-op */
    }
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduce ? 0 : Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
    >
      <Panel interactive className="overflow-hidden p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-card border font-mono text-sm font-semibold"
            style={{ borderColor: meta.colorVar, color: meta.colorVar }}
          >
            {evidence.domain.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-text truncate font-mono text-sm">{evidence.domain}</span>
              <SourceTierBadge tier={evidence.source_tier} />
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-xs tracking-wide uppercase" style={{ color: meta.colorVar }}>
                {meta.label}
              </span>
              <span className="text-mute" aria-hidden>·</span>
              <span className="text-mute font-mono text-xs tabular-nums">
                {Math.round(evidence.similarity * 100)}% match
              </span>
            </div>
          </div>
          {/* relevance bar */}
          <div className="hidden w-16 sm:block" title={`${Math.round(evidence.similarity * 100)}% relevance`}>
            <div className="bg-line h-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.round(evidence.similarity * 100)}%`, backgroundColor: meta.colorVar, opacity: 0.7 }}
              />
            </div>
          </div>
        </div>

        <blockquote className="border-line/70 mt-3 border-l-2 pl-3" style={{ borderColor: meta.colorVar }}>
          <p className={cn("text-text-2 text-sm leading-relaxed", !expanded && isLong && "line-clamp-3")}>
            “{span}”
          </p>
        </blockquote>

        {claimText && (
          <p className="text-mute mt-2 truncate text-xs">
            on claim: <span className="text-text-2">{claimText}</span>
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {isLong ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-mute hover:text-text font-mono text-xs transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={copySpan}
              className="text-mute hover:text-text inline-flex items-center gap-1.5 rounded-data px-2 py-1 font-mono text-xs transition-colors hover:bg-panel-hover"
            >
              {copied ? <Check className="text-signal size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-mute hover:text-signal inline-flex items-center gap-1.5 rounded-data px-2 py-1 font-mono text-xs transition-colors hover:bg-panel-hover"
            >
              Visit
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}
