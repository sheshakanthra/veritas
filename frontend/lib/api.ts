import { AnalysisResultSchema, type AnalysisResult } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function submitAnalysis(text: string): Promise<{ analysisId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.detail ?? `Request failed with status ${response.status}`, response.status);
  }

  const body = (await response.json()) as { analysis_id: string };
  return { analysisId: body.analysis_id };
}

export async function fetchAnalysis(analysisId: string): Promise<AnalysisResult | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze/${analysisId}`, {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
  return AnalysisResultSchema.parse(await response.json());
}
