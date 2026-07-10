"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/* Geometry for a top semicircle gauge. */
const CX = 100;
const CY = 104;
const R = 84;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Point on the top arc for a fraction f in [0,1] (0 = left, 1 = right). */
function pointAt(f: number): { x: number; y: number } {
  const theta = Math.PI * (1 - clamp01(f)); // 180deg..0deg
  return { x: CX + R * Math.cos(theta), y: CY - R * Math.sin(theta) };
}

function useCountUp(target: number, durationMs: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = clamp01((now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(target * eased); // inside a rAF callback, not the effect body
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);
  return enabled ? value : target;
}

interface ConfidenceGaugeProps {
  /** Mean calibrated confidence, 0..1. */
  value: number;
  /** [lower, upper] calibrated interval, 0..1 - rendered as a band so the
   * gauge shows a range, never false single-point precision. */
  interval: [number, number];
  /** CSS color var for the verdict, e.g. "var(--v-supports)". */
  colorVar: string;
  className?: string;
}

/**
 * The calibrated-confidence readout. The filled arc sweeps to the mean;
 * a lighter band marks the honest interval around it. The number counts
 * up on reveal. This is the one gauge in the app, and it earns the label
 * by drawing the interval, not flattening it to a percentage.
 */
export function ConfidenceGauge({ value, interval, colorVar, className }: ConfidenceGaugeProps) {
  const reduce = usePrefersReducedMotion();
  const v = clamp01(value);
  const lower = clamp01(interval[0]);
  const upper = clamp01(interval[1]);
  const shown = useCountUp(v, 720, !reduce);
  const marker = pointAt(v);

  return (
    <div className={cn("relative w-full max-w-[220px]", className)}>
      <svg viewBox="0 0 200 128" className="w-full overflow-visible" role="img"
        aria-label={`Confidence ${Math.round(v * 100)} percent, interval ${Math.round(lower * 100)} to ${Math.round(upper * 100)} percent`}>
        {/* track */}
        <path d={ARC} fill="none" stroke="var(--v-line)" strokeWidth={9} strokeLinecap="round" />
        {/* honest interval band */}
        <path
          d={ARC}
          fill="none"
          stroke={colorVar}
          strokeOpacity={0.22}
          strokeWidth={9}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${Math.max(0, upper - lower)} ${1 - Math.max(0, upper - lower)}`}
          strokeDashoffset={-lower}
        />
        {/* value sweep */}
        <motion.path
          d={ARC}
          fill="none"
          stroke={colorVar}
          strokeWidth={9}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: v }}
          transition={{ duration: reduce ? 0 : 0.72, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* endpoint marker */}
        <motion.circle
          cx={marker.x}
          cy={marker.y}
          r={6}
          fill="var(--v-void)"
          stroke={colorVar}
          strokeWidth={3}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : 0.62, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-text font-mono text-4xl leading-none tabular-nums" style={{ color: colorVar }}>
          {Math.round(shown * 100)}
          <span className="text-mute text-lg">%</span>
        </span>
        <span className="text-mute mt-1 font-mono text-xs tracking-wide tabular-nums">
          {lower.toFixed(2)}–{upper.toFixed(2)} interval
        </span>
      </div>
    </div>
  );
}
