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

export interface AuthUser {
  userId: string;
  email: string;
}

/** FastAPI 422 validation errors return `detail` as an array, not a string. */
function detailOrFallback(body: { detail?: unknown }, fallback: string): string {
  return typeof body.detail === "string" ? body.detail : fallback;
}

export async function submitAnalysis(text: string): Promise<{ analysisId: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      detailOrFallback(body, `Request failed with status ${response.status}`),
      response.status
    );
  }

  const body = (await response.json()) as { analysis_id: string };
  return { analysisId: body.analysis_id };
}

export async function fetchAnalysis(analysisId: string): Promise<AnalysisResult | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze/${analysisId}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
  return AnalysisResultSchema.parse(await response.json());
}

async function authRequest(path: string, email: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      detailOrFallback(body, `Request failed with status ${response.status}`),
      response.status
    );
  }

  const body = (await response.json()) as { user_id: string; email: string };
  return { userId: body.user_id, email: body.email };
}

export function signup(email: string, password: string): Promise<AuthUser> {
  return authRequest("signup", email, password);
}

export function login(email: string, password: string): Promise<AuthUser> {
  return authRequest("login", email, password);
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    cache: "no-store",
    credentials: "include",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
  const body = (await response.json()) as { user_id: string; email: string };
  return { userId: body.user_id, email: body.email };
}
