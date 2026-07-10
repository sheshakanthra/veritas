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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchCalibrationReport(): Promise<CalibrationReport> {
  const response = await fetch(`${API_BASE_URL}/health/calibration`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Calibration report request failed with status ${response.status}`);
  }
  return CalibrationReportSchema.parse(await response.json());
}
