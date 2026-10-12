/**
 * Tiny in-memory fixed-window rate limiter (per server instance). Good enough to stop a
 * single client hammering the paid model; not a distributed guarantee.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit = 20, windowMs = 60_000, now = Date.now()): RateLimitResult {
  if (now - lastSweep > windowMs) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }

  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;

  const ok = b.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - b.count),
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
  };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}
