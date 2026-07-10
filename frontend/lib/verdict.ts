import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { ComponentType } from "react";
import type { Verdict } from "@/lib/types";

export interface VerdictMeta {
  label: string;
  /** CSS custom-property reference for this verdict's colour. */
  colorVar: string;
  /** One plain-language line: what the verdict means for the reader. */
  meaning: string;
  Icon: ComponentType<{ className?: string }>;
}

/**
 * Single source of truth for how each verdict is named, coloured, iconed,
 * and explained. Every verdict surface (badge, hero, spine) reads from
 * here so the four outcomes always look and read the same way.
 */
export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  SUPPORTED: {
    label: "Supported",
    colorVar: "var(--v-supports)",
    meaning: "The evidence backs this claim.",
    Icon: CheckCircle2,
  },
  REFUTED: {
    label: "Refuted",
    colorVar: "var(--v-refutes)",
    meaning: "The evidence contradicts this claim.",
    Icon: XCircle,
  },
  MISLEADING_CONTEXT: {
    label: "Missing context",
    colorVar: "var(--v-caution)",
    meaning: "Partly true, but the framing leaves out what changes the picture.",
    Icon: AlertTriangle,
  },
  UNVERIFIABLE: {
    label: "Unverifiable",
    colorVar: "var(--v-mute)",
    meaning: "Not enough evidence to rule either way.",
    Icon: HelpCircle,
  },
};
