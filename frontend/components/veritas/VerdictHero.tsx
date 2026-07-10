"use client";

import { motion } from "framer-motion";
import { ConfidenceGauge } from "@/components/veritas/ConfidenceGauge";
import { Eyebrow, Panel } from "@/components/veritas/primitives";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { VERDICT_META } from "@/lib/verdict";
import type { Verdict } from "@/lib/types";

interface VerdictHeroProps {
  verdict: Verdict;
  confidence: number;
  interval: [number, number];
  claimsScored: number;
  claimsTotal: number;
  evidenceCount: number;
  tier1Count: number;
  agreement: number | null;
}

/**
 * The verdict owns the top of the analysis page. Big word, plain meaning,
 * the calibrated gauge, and the four numbers that back it up.
 */
export function VerdictHero({
  verdict,
  confidence,
  interval,
  claimsScored,
  claimsTotal,
  evidenceCount,
  tier1Count,
  agreement,
}: VerdictHeroProps) {
  const reduce = usePrefersReducedMotion();
  const meta = VERDICT_META[verdict];
  const Icon = meta.Icon;

  const stats: { value: string; label: string }[] = [
    { value: `${claimsScored}/${claimsTotal}`, label: "claims checked" },
    { value: String(evidenceCount), label: "sources" },
    { value: String(tier1Count), label: "tier-1" },
    { value: agreement == null ? "—" : `${Math.round(agreement * 100)}%`, label: "agreement" },
  ];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Panel raised className="relative overflow-hidden">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: meta.colorVar }} />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 45% 90% at 100% 0%, color-mix(in srgb, ${meta.colorVar} 12%, transparent), transparent 70%)`,
          }}
        />

        <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Eyebrow className="mb-5">Overall verdict</Eyebrow>
            <div className="flex items-center gap-3">
              <Icon className="size-8 shrink-0" />
              <span className="text-4xl leading-none font-semibold tracking-tight" style={{ color: meta.colorVar }}>
                {meta.label}
              </span>
            </div>
            <p className="text-text-2 mt-4 max-w-md text-lg leading-relaxed">{meta.meaning}</p>

            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col gap-1">
                  <span className="text-text font-mono text-xl leading-none tabular-nums">{s.value}</span>
                  <span className="text-mute font-mono text-xs tracking-wide uppercase">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center md:pr-6">
            <ConfidenceGauge value={confidence} interval={interval} colorVar={meta.colorVar} />
          </div>
        </div>
      </Panel>
    </motion.div>
  );
}
