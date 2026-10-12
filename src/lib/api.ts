// Client-side helpers for the app's route handlers.
// All helpers throw ApiError(message, status) on non-2xx responses (except getSession's 404 -> null).
import type { JudgeRequest, JudgeResult, RunSubmission, SessionRow } from "./types";

async function readError(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "error" in data) {
      const err = (data as { error: unknown }).error;
      if (typeof err === "string" && err) return err;
    }
  } catch {
    // body was not JSON
  }
  return `Request failed (${res.status})`;
}

/** Error thrown by the helpers below; carries the HTTP status and any Retry-After (seconds). */
export class ApiError extends Error {
  status: number;
  retryAfterSec: number | null;
  constructor(message: string, status: number, retryAfterSec: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    throw new ApiError(await readError(res), res.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
  }
  return (await res.json()) as T;
}

/** POST /api/runs */
export function submitRun(run: RunSubmission): Promise<{ id: string; rank: number | null }> {
  return postJson("/api/runs", run);
}

/** POST /api/sessions */
export function createSession(name: string): Promise<{ code: string; name: string; hostKey: string }> {
  return postJson("/api/sessions", { name });
}

/** GET /api/sessions/[code] — null on 404 */
export async function getSession(code: string): Promise<SessionRow | null> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(code)}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(await readError(res), res.status, null);
  return (await res.json()) as SessionRow;
}

/** POST /api/sessions/[code]/start  body { hostKey } */
export function startSession(code: string, hostKey: string): Promise<SessionRow> {
  return postJson(`/api/sessions/${encodeURIComponent(code)}/start`, { hostKey });
}

/** POST /api/sessions/[code]/end  body { hostKey } (admin power, see PLAN.md) */
export function endSession(code: string, hostKey: string): Promise<SessionRow> {
  return postJson(`/api/sessions/${encodeURIComponent(code)}/end`, { hostKey });
}

/** POST /api/sessions/[code]/reset  body { hostKey } — admin "Reset to lobby" (status -> lobby) */
export function resetSession(code: string, hostKey: string): Promise<SessionRow> {
  return postJson(`/api/sessions/${encodeURIComponent(code)}/reset`, { hostKey });
}

/** Client deadline for one judge call (server maxDuration is 30s). */
const JUDGE_TIMEOUT_MS = 35_000;

/**
 * POST /api/judge. On a 429 it waits min(Retry-After, 10)s and retries once; the whole call is
 * bounded by JUDGE_TIMEOUT_MS so a stalled request is cancelled instead of left running.
 */
export async function judgeAnswer(req: JudgeRequest): Promise<JudgeResult> {
  const signal = AbortSignal.timeout(JUDGE_TIMEOUT_MS);
  try {
    return await postJson<JudgeResult>("/api/judge", req, signal);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 429) throw err;
    const waitMs = Math.min(err.retryAfterSec ?? 5, 10) * 1000;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, waitMs);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(signal.reason);
      }, { once: true });
    });
    return postJson<JudgeResult>("/api/judge", req, signal);
  }
}
