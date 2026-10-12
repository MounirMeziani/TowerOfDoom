// Tiny in-memory sliding-window rate limiter, keyed by client IP.
// Best-effort only: Vercel Fluid Compute reuses instances, but separate instances keep separate counters.

type Bucket = number[];

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

/** First entry of x-forwarded-for (set by Vercel), then x-real-ip, else "unknown". */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function prune(now: number, windowMs: number) {
  if (buckets.size <= MAX_KEYS) return;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || now - hits[hits.length - 1] > windowMs) buckets.delete(key);
  }
  // Still too big (a flood of unique keys): drop the oldest half.
  if (buckets.size > MAX_KEYS) {
    let drop = Math.floor(buckets.size / 2);
    for (const key of buckets.keys()) {
      if (drop-- <= 0) break;
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the next request would be allowed (0 when ok). */
  retryAfterSec: number;
}

/** Records a hit for `key` and reports whether it is within `limit` hits per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now, windowMs);
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, remaining: limit - hits.length, retryAfterSec: 0 };
}

/** Convenience: limit by route name + client IP. Returns a 429 Response when over the limit, else null. */
export function limitRequest(req: Request, route: string, limit: number, windowMs = 60_000): Response | null {
  const result = rateLimit(`${route}:${getClientIp(req)}`, limit, windowMs);
  if (result.ok) return null;
  return Response.json(
    { error: "Whoa there, speedy adventurer. Too many requests, try again in a moment." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec), "Cache-Control": "no-store" } },
  );
}
