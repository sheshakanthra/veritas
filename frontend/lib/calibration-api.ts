import { z } from "zod";

const ReliabilityBinSchema = z.object({
  bin_lower: z.number(),
  bin_upper: z.number(),
  predicted_confidence_mean: z.number(),
  empirical_accuracy: z.number(),
  sample_count: z.number(),
});

const CalibrationReportSchema = z.object({
  bins: z.array(ReliabilityBinSchema),
  total_samples: z.number(),
  expected_calibration_error: z.number(),
  note: z.string(),
});

export type CalibrationReport = z.infer<typeof CalibrationReportSchema>;

/**
 * This module runs on the server (the /calibration page is an async RSC),
 * where fetch requires an absolute URL — a relative "/health/..." only
 * works in the browser. In production on Vercel, the frontend and backend
 * share one origin (Vercel Services), so we hit the deployment origin and
 * let the vercel.json rewrite route /health/* to the backend service.
 */
function apiBaseUrl(): string {
  // Browser: same-origin relative path (empty base) avoids CORS.
  if (typeof window !== "undefined") return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  // Server on Vercel: the deployment's own origin.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Server in local dev (or any explicit override).
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
}

export async function fetchCalibrationReport(): Promise<CalibrationReport> {
  const response = await fetch(`${apiBaseUrl()}/health/calibration`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Calibration report request failed with status ${response.status}`);
  }
  return CalibrationReportSchema.parse(await response.json());
}
