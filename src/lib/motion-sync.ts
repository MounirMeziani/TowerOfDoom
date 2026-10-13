// Motion sync: hero positions over Supabase Realtime broadcast event "pos" on the SHARED
// "lobby:<CODE>" channel (the same channel lobby.ts uses for presence + status; never a second one).
//
// Wire payload (kept tiny): { id, h, x, z, r, m }
//   id = playerId, h = heroId, x/z = ground position (2 decimals), r = facing (radians, 2 decimals),
//   m = moving.
// Rate: Supabase counts every DELIVERY (one send reaches all N clients), so the budget is a fan-out
// budget: interval >= max(200ms, N * N * 1000 / MOTION_FANOUT_BUDGET) keeps a session's motion near
// MOTION_FANOUT_BUDGET deliveries/s (free plan default 250: 1.6s at N=20, 3.6s at N=30, 6.4s at N=40;
// set NEXT_PUBLIC_RT_FANOUT_BUDGET=2000 on a plan with a higher Realtime limit for 0.2-0.8s).
// Sends only on change (moving, plus one when movement stops); an idle heartbeat every
// motionHeartbeat(N) (>= 3s); one send immediately on (re)join, a jittered one when the roster grows or
// another client says hello (reload / late host), each still gated by the adaptive interval.
"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { acquireLobbyChannel, type LobbyChannelHandle } from "./lobby";

/* ------------------------------------------------------------------------------------------------
 * Pure helpers (exported for tests)
 * ---------------------------------------------------------------------------------------------- */

export type MotionSample = { x: number; z: number; rotY: number; moving: boolean };

export interface PosMessage {
  id: string;
  h: string;
  x: number;
  z: number;
  r: number;
  m: boolean;
}

export interface RemoteMotion {
  heroId: string;
  x: number;
  z: number;
  rotY: number;
  moving: boolean;
  /** Date.now() when the latest message arrived. */
  lastSeen: number;
  /** Extra: previous sample, for velocity estimates during interpolation. */
  prevX: number;
  prevZ: number;
  prevSeen: number;
}

export const MOTION_MIN_INTERVAL_MS = 200; // 5 Hz cap per client
/** Motion deliveries per second across the whole session (sends x receivers). */
export const MOTION_FANOUT_BUDGET = Number(process.env.NEXT_PUBLIC_RT_FANOUT_BUDGET) || 250;
export const MOTION_HEARTBEAT_MS = 3000; // minimum idle heartbeat (small sessions)
export const MOTION_STALE_MS = 15_000; // minimum staleness (small sessions); see motionStaleMs
export const MOTION_TICK_MS = 100;
const POS_EPS = 0.02;
const ROT_EPS = 0.06;
const WORLD_LIMIT = 200;

function rosterN(rosterSize: number): number {
  return Number.isFinite(rosterSize) ? Math.max(1, Math.floor(rosterSize)) : 1;
}

/**
 * Minimum gap between two sends for one client, given how many players share the channel. Each send
 * reaches about N receivers (the other players plus the host), so N senders cost ~N*N deliveries.
 */
export function motionInterval(rosterSize: number): number {
  const n = rosterN(rosterSize);
  return Math.max(MOTION_MIN_INTERVAL_MS, Math.ceil((n * n * 1000) / MOTION_FANOUT_BUDGET));
}

/** Idle heartbeat for one client: at least MOTION_HEARTBEAT_MS, and 3x the adaptive interval. */
export function motionHeartbeat(rosterSize: number): number {
  return Math.max(MOTION_HEARTBEAT_MS, motionInterval(rosterSize) * 3);
}

/** How long a remote hero may stay silent before it is hidden (3 missed heartbeats, >= 15s). */
export function motionStaleMs(rosterSize: number): number {
  return Math.max(MOTION_STALE_MS, motionHeartbeat(rosterSize) * 3);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalizes an angle into (-PI, PI]. */
function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** Builds the wire payload for a sample (rounded, angle wrapped). */
export function toPosMessage(id: string, heroId: string, s: MotionSample): PosMessage {
  return { id, h: heroId, x: round2(s.x), z: round2(s.z), r: round2(wrapAngle(s.rotY)), m: !!s.moving };
}

/** True when `next` differs enough from the last sent payload to be worth sending. */
export function motionChanged(prev: PosMessage | null, next: PosMessage): boolean {
  if (!prev) return true;
  if (prev.h !== next.h || prev.m !== next.m) return true;
  if (Math.abs(prev.x - next.x) > POS_EPS || Math.abs(prev.z - next.z) > POS_EPS) return true;
  const dr = Math.abs(wrapAngle(prev.r - next.r));
  return dr > ROT_EPS;
}

/**
 * Send decision for one publisher tick (n = rosterSize).
 *  - force (join / roster grew / hello / hero changed): send once motionInterval(n) passed (on a
 *    (re)subscribe lastSentAt is -Infinity, so the first send goes out at once)
 *  - changed: send once motionInterval(n) passed
 *  - otherwise: heartbeat every motionHeartbeat(n)
 * `slow` (the server throttled us) doubles both intervals.
 */
export function shouldSendMotion(opts: {
  prev: PosMessage | null;
  next: PosMessage;
  now: number;
  lastSentAt: number;
  rosterSize: number;
  force?: boolean;
  slow?: boolean;
}): boolean {
  const elapsed = opts.now - opts.lastSentAt;
  const k = opts.slow ? 2 : 1;
  if (elapsed < motionInterval(opts.rosterSize) * k) return false;
  if (opts.force) return true;
  if (elapsed >= motionHeartbeat(opts.rosterSize) * k) return true;
  return motionChanged(opts.prev, opts.next);
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Validates one untrusted "pos" payload from any client. */
export function parsePosMessage(raw: unknown): PosMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id || r.id.length > 64) return null;
  const x = finite(r.x);
  const z = finite(r.z);
  if (x === null || z === null) return null;
  const rot = finite(r.r) ?? 0;
  return {
    id: r.id,
    h: typeof r.h === "string" ? r.h.slice(0, 40) : "",
    x: Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, x)),
    z: Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, z)),
    r: wrapAngle(rot),
    m: r.m === true,
  };
}

/** Applies a validated message to the remote map (ignores our own id). Returns true if applied. */
export function mergeRemoteMotion(
  map: Map<string, RemoteMotion>,
  msg: PosMessage,
  now: number,
  selfId: string | null,
): boolean {
  if (selfId && msg.id === selfId) return false;
  const prev = map.get(msg.id);
  map.set(msg.id, {
    heroId: msg.h || prev?.heroId || "",
    x: msg.x,
    z: msg.z,
    rotY: msg.r,
    moving: msg.m,
    lastSeen: now,
    prevX: prev ? prev.x : msg.x,
    prevZ: prev ? prev.z : msg.z,
    prevSeen: prev ? prev.lastSeen : now,
  });
  return true;
}

export function isMotionStale(m: RemoteMotion, now: number, staleMs = MOTION_STALE_MS): boolean {
  return now - m.lastSeen > staleMs;
}

/** Removes entries not heard from in staleMs * 4 (keeps the map from growing forever). */
export function pruneRemoteMotion(map: Map<string, RemoteMotion>, now: number, staleMs = MOTION_STALE_MS): void {
  for (const [id, m] of map) if (now - m.lastSeen > staleMs * 4) map.delete(id);
}

/* ------------------------------------------------------------------------------------------------
 * Framework-free cores (used by the hooks; also driven directly by the Node sync test)
 * ---------------------------------------------------------------------------------------------- */

export interface MotionPublisherCore {
  /** Force a send at the next tick (e.g. hero changed). */
  poke(): void;
  stop(): void;
}

export function startMotionPublisher(
  handle: LobbyChannelHandle,
  playerId: string,
  getHeroId: () => string,
  getSample: () => MotionSample,
  opts: { tickMs?: number; now?: () => number } = {},
): MotionPublisherCore {
  const now = opts.now ?? (() => Date.now());
  let last: PosMessage | null = null;
  let lastSentAt = -Infinity;
  let force = true; // send once immediately on join
  let forceAt = Infinity; // coalesced, jittered force after the roster grew
  let roster = handle.rosterSize();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const tick = () => {
    if (!handle.isSubscribed()) return;
    const size = handle.rosterSize();
    const t = now();
    // Someone joined: let them see us soon, jittered so N clients do not all re-send at once.
    if (size > roster && forceAt === Infinity) forceAt = t + Math.random() * Math.min(1000, motionInterval(size));
    roster = size;
    const next = toPosMessage(playerId, getHeroId(), getSample());
    const send = shouldSendMotion({
      prev: last,
      next,
      now: t,
      lastSentAt,
      rosterSize: size,
      force: force || t >= forceAt,
      slow: handle.isThrottled(),
    });
    if (!send) return;
    if (handle.send("pos", { ...next })) {
      last = next;
      lastSentAt = t;
      force = false;
      forceAt = Infinity;
    }
  };

  const offSub = handle.onSubscribed(() => {
    force = true;
    lastSentAt = -Infinity;
    tick();
  });
  // A client (re)joined or a host opened the projector: they have no position for us yet and our
  // roster may not grow (reload / observer), so re-send once soon (jittered over 800ms).
  const offHello = handle.onHello(() => {
    const h = setTimeout(() => {
      timers.delete(h);
      force = true;
    }, Math.floor(Math.random() * 800));
    timers.add(h);
  });
  const timer = setInterval(tick, opts.tickMs ?? MOTION_TICK_MS);
  return {
    poke() {
      force = true;
    },
    stop() {
      clearInterval(timer);
      offSub();
      offHello();
      for (const h of timers) clearTimeout(h);
      timers.clear();
    },
  };
}

export function startMotionReceiver(
  handle: LobbyChannelHandle,
  selfId: string | null,
  map: Map<string, RemoteMotion>,
  opts: { now?: () => number } = {},
): () => void {
  const now = opts.now ?? (() => Date.now());
  let count = 0;
  return handle.onBroadcast("pos", (payload) => {
    const msg = parsePosMessage(payload);
    if (!msg) return;
    const t = now();
    mergeRemoteMotion(map, msg, t, selfId);
    if (++count % 50 === 0) pruneRemoteMotion(map, t, motionStaleMs(handle.rosterSize() + 1));
  });
}

/* ------------------------------------------------------------------------------------------------
 * Hooks
 * ---------------------------------------------------------------------------------------------- */

/**
 * Publishes this player's hero position on "lobby:<CODE>" (event "pos"). No-op until code, playerId
 * and heroId are all known. stateRef is read on a 100ms tick (no re-renders).
 */
export function useMotionPublisher(
  code: string | null,
  playerId: string | null,
  heroId: string | null,
  stateRef: MutableRefObject<MotionSample>,
): void {
  const heroRef = useRef(heroId ?? "");
  const coreRef = useRef<MotionPublisherCore | null>(null);

  useEffect(() => {
    heroRef.current = heroId ?? "";
    coreRef.current?.poke();
  }, [heroId]);

  const active = !!code && !!playerId && !!heroId;
  useEffect(() => {
    if (!active || !code || !playerId) return;
    const handle = acquireLobbyChannel(code, playerId);
    const core = startMotionPublisher(
      handle,
      playerId,
      () => heroRef.current,
      () => stateRef.current,
    );
    coreRef.current = core;
    return () => {
      core.stop();
      if (coreRef.current === core) coreRef.current = null;
      handle.release();
    };
  }, [active, code, playerId, stateRef]);
}

/**
 * Listens to "pos" broadcasts on "lobby:<CODE>" and keeps the latest state per remote player in a
 * mutable Map (read it inside useFrame; it never triggers re-renders). selfId is ignored.
 */
export function useRemoteMotion(code: string | null, selfId: string | null): MutableRefObject<Map<string, RemoteMotion>> {
  const ref = useRef<Map<string, RemoteMotion>>(new Map());

  useEffect(() => {
    if (!code) return;
    const map = ref.current;
    const handle = acquireLobbyChannel(code, selfId);
    const off = startMotionReceiver(handle, selfId, map);
    return () => {
      off();
      handle.release();
      map.clear();
    };
  }, [code, selfId]);

  return ref;
}
