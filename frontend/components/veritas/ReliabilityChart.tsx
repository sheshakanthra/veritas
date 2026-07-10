"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CalibrationReport } from "@/lib/calibration-api";

/**
 * The one Recharts usage in the app, scoped to /calibration only, per the
 * design brief - this is the single place a conventional chart earns its
 * place, because reliability bins are inherently a bar comparison, not
 * something the Spine's vocabulary covers.
 */
export function ReliabilityChart({ bins }: { bins: CalibrationReport["bins"] }) {
  const data = bins.map((bin) => ({
    range: `${bin.bin_lower.toFixed(1)}-${bin.bin_upper.toFixed(1)}`,
    "Predicted confidence": bin.predicted_confidence_mean,
    "Empirical accuracy": bin.empirical_accuracy,
    n: bin.sample_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--v-line)" strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="range"
          stroke="var(--v-mute)"
          tick={{ fill: "var(--v-mute)", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}
        />
        <YAxis
          domain={[0, 1]}
          stroke="var(--v-mute)"
          tick={{ fill: "var(--v-mute)", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--v-panel-raised)",
            border: "1px solid var(--v-line)",
            borderRadius: 10,
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 12,
            color: "var(--v-text)",
          }}
        />
        <Legend wrapperStyle={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }} />
        <Bar dataKey="Predicted confidence" fill="var(--v-signal)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="Empirical accuracy" fill="var(--v-mute)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
