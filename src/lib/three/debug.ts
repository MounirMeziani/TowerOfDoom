/**
 * Test hook for Playwright: scenes publish a small snapshot on window.__TOD__.
 * Writes are merged and throttled to ~5 per second (trailing write guaranteed).
 */

export type TodDebug = {
  scene: "lobby" | "climb" | "host";
  self?: { x: number; z: number };
  remoteCount?: number;
  rosterCount?: number;
  remotes?: Record<string, { x: number; z: number }>;
  floor?: number;
  nearSensei?: boolean;
  questionOpen?: boolean;
};

declare global {
  interface Window {
    __TOD__?: TodDebug;
  }
}

const INTERVAL_MS = 200;

let pending: Partial<TodDebug> | null = null;
let lastFlush = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function flush(): void {
  timer = null;
  if (typeof window === "undefined" || !pending) return;
  const patch = pending;
  pending = null;
  lastFlush = Date.now();
  const next = { ...(window.__TOD__ ?? { scene: "lobby" }), ...patch } as TodDebug;
  if (next.self) next.self = { x: round2(next.self.x), z: round2(next.self.z) };
  window.__TOD__ = next;
}

/** Merge a patch into window.__TOD__ (throttled; safe to call every frame). */
export function setDebug(patch: Partial<TodDebug>): void {
  if (typeof window === "undefined") return;
  pending = pending ? { ...pending, ...patch } : { ...patch };
  const wait = INTERVAL_MS - (Date.now() - lastFlush);
  if (wait <= 0) {
    if (timer) clearTimeout(timer);
    flush();
  } else if (!timer) {
    timer = setTimeout(flush, wait);
  }
}

/** Replace window.__TOD__ immediately with a fresh snapshot for a new scene. */
export function resetDebug(scene: TodDebug["scene"], extra?: Partial<TodDebug>): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  lastFlush = Date.now();
  window.__TOD__ = { ...extra, scene };
}
