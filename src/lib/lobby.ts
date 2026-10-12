// Lobby realtime: Supabase Realtime Presence + Broadcast on channel "lobby:<CODE>".
// Client-only hooks (import from "use client" components). One channel per code per page is shared
// across hooks through a small ref-counted registry, because presence and broadcast use the same topic
// and supabase-js returns/reuses channels by topic.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSession } from "./api";
import { getBrowserSupabase } from "./supabase/browser";
import type { LobbyPresence, PlayerPhase, SessionRow, SessionStatus } from "./types";

/* ------------------------------------------------------------------------------------------------
 * Pure helpers (exported for tests)
 * ---------------------------------------------------------------------------------------------- */

const PHASES: readonly PlayerPhase[] = ["lobby", "playing", "finished"];
const STATUSES: readonly SessionStatus[] = ["lobby", "playing", "ended"];

export function isSessionStatus(v: unknown): v is SessionStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

function finiteInt(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Validates one untrusted presence meta (from any client) into a LobbyPresence, or null. */
export function parseLobbyPresence(raw: unknown): (LobbyPresence & { _ts: number }) | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.playerId !== "string" || !r.playerId || r.playerId.length > 64) return null;
  if (typeof r.name !== "string") return null;
  const name = r.name.trim().slice(0, 24);
  if (!name) return null;
  const heroId = typeof r.heroId === "string" ? r.heroId.slice(0, 40) : "";
  const phase: PlayerPhase = PHASES.includes(r.phase as PlayerPhase) ? (r.phase as PlayerPhase) : "lobby";
  const joinedAtMs = typeof r.joinedAt === "string" ? Date.parse(r.joinedAt) : NaN;
  const joinedAt = Number.isFinite(joinedAtMs) ? new Date(joinedAtMs).toISOString() : new Date(0).toISOString();
  const out: LobbyPresence & { _ts: number } = {
    playerId: r.playerId,
    name,
    heroId,
    phase,
    joinedAt,
    _ts: typeof r._ts === "number" && Number.isFinite(r._ts) ? r._ts : 0,
  };
  const floor = finiteInt(r.floor, 0, 99);
  const score = finiteInt(r.score, 0, 1_000_000);
  const hearts = finiteInt(r.hearts, 0, 99);
  if (floor !== undefined) out.floor = floor;
  if (score !== undefined) out.score = score;
  if (hearts !== undefined) out.hearts = hearts;
  return out;
}

/**
 * Flattens a Supabase presenceState() ({ [key]: meta[] }) into LobbyPresence[]:
 * validates every meta, dedupes by playerId keeping the latest (highest _ts, later meta wins ties),
 * and sorts by joinedAt then playerId.
 */
export function flattenPresenceState(state: Record<string, unknown>): LobbyPresence[] {
  const byId = new Map<string, LobbyPresence & { _ts: number }>();
  for (const metas of Object.values(state ?? {})) {
    if (!Array.isArray(metas)) continue;
    for (const meta of metas) {
      const p = parseLobbyPresence(meta);
      if (!p) continue;
      const prev = byId.get(p.playerId);
      if (!prev || p._ts >= prev._ts) byId.set(p.playerId, p);
    }
  }
  return [...byId.values()]
    .map(({ _ts, ...rest }) => {
      void _ts;
      return rest;
    })
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.playerId.localeCompare(b.playerId));
}

/** Shallow-ish equality for presence lists (avoids re-renders when nothing changed). */
export function samePlayers(a: LobbyPresence[], b: LobbyPresence[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.playerId !== y.playerId ||
      x.name !== y.name ||
      x.heroId !== y.heroId ||
      x.phase !== y.phase ||
      x.floor !== y.floor ||
      x.score !== y.score ||
      x.hearts !== y.hearts ||
      x.joinedAt !== y.joinedAt
    ) {
      return false;
    }
  }
  return true;
}

export function sameSession(a: SessionRow | null, b: SessionRow | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.code === b.code &&
    a.name === b.name &&
    a.status === b.status &&
    a.started_at === b.started_at &&
    a.created_at === b.created_at
  );
}

export function lobbyTopic(code: string): string {
  return `lobby:${code.toUpperCase()}`;
}

/* ------------------------------------------------------------------------------------------------
 * Channel registry (one shared channel per code per page, ref counted)
 * ---------------------------------------------------------------------------------------------- */

interface Snapshot {
  players: LobbyPresence[];
  connected: boolean;
}

interface StatusMessage {
  status: SessionStatus;
  startedAt: string | null;
}

interface Entry {
  code: string;
  refs: number;
  presenceKey: string | null;
  channel: RealtimeChannel | null;
  creating: boolean;
  subscribed: boolean;
  snapshot: Snapshot;
  storeListeners: Set<() => void>;
  statusListeners: Set<(msg: StatusMessage) => void>;
  subscribedWaiters: Set<() => void>;
  // presence tracking (one tracked payload per channel; last writer wins)
  desiredTrack: LobbyPresence | null;
  tracked: boolean;
  lastTrackAt: number;
  trackTimer: ReturnType<typeof setTimeout> | null;
  untrackTimer: ReturnType<typeof setTimeout> | null;
  teardownTimer: ReturnType<typeof setTimeout> | null;
}

const EMPTY_SNAPSHOT: Snapshot = { players: [], connected: false };
// Supabase Realtime allows each client about 5 presence messages (track + untrack) per 30s window.
// flushTrack coalesces calls and sends the latest desired payload on a trailing timer, so the newest
// floor/score/hearts still arrive, at most once per 7s.
const TRACK_MIN_INTERVAL_MS = 7000;
const TEARDOWN_DELAY_MS = 1500; // survives StrictMode remounts and route transitions
// Deferred untrack: long enough for the next page (lobby -> /play) to take over the same channel and
// replace the payload with a single track instead of untrack + track.
const UNTRACK_DELAY_MS = TEARDOWN_DELAY_MS - 250;

const registry = new Map<string, Entry>();
const pendingRemovals = new Map<string, Promise<unknown>>();

function randomKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `obs-${crypto.randomUUID()}`;
  } catch {
    // insecure context
  }
  return `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emit(entry: Entry, patch: Partial<Snapshot>) {
  const next: Snapshot = { ...entry.snapshot, ...patch };
  if (next.connected === entry.snapshot.connected && samePlayers(next.players, entry.snapshot.players)) return;
  entry.snapshot = next;
  for (const l of entry.storeListeners) l();
}

function flushTrack(entry: Entry) {
  const ch = entry.channel;
  if (!ch || !entry.subscribed) return;
  if (entry.trackTimer) {
    clearTimeout(entry.trackTimer);
    entry.trackTimer = null;
  }
  const wait = entry.lastTrackAt + TRACK_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    entry.trackTimer = setTimeout(() => {
      entry.trackTimer = null;
      flushTrack(entry);
    }, wait);
    return;
  }
  entry.lastTrackAt = Date.now();
  const desired = entry.desiredTrack;
  if (desired) {
    entry.tracked = true;
    void ch.track({ ...desired, _ts: Date.now() }).catch(() => undefined);
  } else if (entry.tracked) {
    entry.tracked = false;
    void ch.untrack().catch(() => undefined);
  }
}

async function createChannel(entry: Entry) {
  const pending = pendingRemovals.get(entry.code);
  if (pending) await pending.catch(() => undefined);
  if (registry.get(entry.code) !== entry || entry.refs <= 0 || entry.channel) {
    entry.creating = false;
    return;
  }
  let supabase;
  try {
    supabase = getBrowserSupabase();
  } catch {
    entry.creating = false;
    return; // not configured: hooks fall back to polling only
  }
  const key = entry.presenceKey ?? randomKey();
  const channel = supabase.channel(lobbyTopic(entry.code), {
    config: { presence: { key, enabled: true }, broadcast: { self: false, ack: false } },
  });
  entry.channel = channel;
  entry.creating = false;

  const sync = () => emit(entry, { players: flattenPresenceState(channel.presenceState() as Record<string, unknown>) });
  channel
    .on("presence", { event: "sync" }, sync)
    .on("presence", { event: "join" }, sync)
    .on("presence", { event: "leave" }, sync)
    .on("broadcast", { event: "status" }, (msg: { payload?: unknown }) => {
      const p = (msg?.payload ?? {}) as Record<string, unknown>;
      if (!isSessionStatus(p.status)) return;
      const message: StatusMessage = {
        status: p.status,
        startedAt: typeof p.startedAt === "string" ? p.startedAt : null,
      };
      for (const l of entry.statusListeners) l(message);
    })
    .subscribe((status) => {
      if (entry.channel !== channel) return;
      if (status === "SUBSCRIBED") {
        entry.subscribed = true;
        entry.lastTrackAt = 0;
        emit(entry, { connected: true });
        for (const w of entry.subscribedWaiters) w();
        entry.subscribedWaiters.clear();
        flushTrack(entry);
      } else {
        // CHANNEL_ERROR / TIMED_OUT / CLOSED: supabase-js retries joins on its own.
        entry.subscribed = false;
        emit(entry, { connected: false });
      }
    });
}

function acquire(code: string, presenceKey?: string | null): Entry {
  let entry = registry.get(code);
  if (!entry) {
    entry = {
      code,
      refs: 0,
      presenceKey: null,
      channel: null,
      creating: false,
      subscribed: false,
      snapshot: EMPTY_SNAPSHOT,
      storeListeners: new Set(),
      statusListeners: new Set(),
      subscribedWaiters: new Set(),
      desiredTrack: null,
      tracked: false,
      lastTrackAt: 0,
      trackTimer: null,
      untrackTimer: null,
      teardownTimer: null,
    };
    registry.set(code, entry);
  }
  entry.refs += 1;
  if (presenceKey && !entry.presenceKey && !entry.channel) entry.presenceKey = presenceKey;
  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }
  if (!entry.channel && !entry.creating) {
    entry.creating = true;
    const e = entry;
    // Defer creation so every hook mounting in this commit can contribute its presence key first.
    queueMicrotask(() => void createChannel(e));
  }
  return entry;
}

function release(entry: Entry) {
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0 || entry.teardownTimer) return;
  entry.teardownTimer = setTimeout(() => {
    entry.teardownTimer = null;
    if (entry.refs > 0) return;
    if (registry.get(entry.code) === entry) registry.delete(entry.code);
    for (const t of [entry.trackTimer, entry.untrackTimer]) if (t) clearTimeout(t);
    entry.subscribedWaiters.clear();
    const ch = entry.channel;
    entry.channel = null;
    entry.subscribed = false;
    if (ch) {
      let removal: Promise<unknown>;
      try {
        const supabase = getBrowserSupabase();
        removal = (async () => {
          try {
            if (entry.tracked) await ch.untrack();
          } catch {
            // ignore
          }
          await supabase.removeChannel(ch);
        })();
      } catch {
        removal = Promise.resolve();
      }
      const tracked = removal.catch(() => undefined).finally(() => {
        if (pendingRemovals.get(entry.code) === tracked) pendingRemovals.delete(entry.code);
      });
      pendingRemovals.set(entry.code, tracked);
    }
  }, TEARDOWN_DELAY_MS);
}

function scheduleUntrack(entry: Entry) {
  if (entry.untrackTimer) clearTimeout(entry.untrackTimer);
  entry.untrackTimer = setTimeout(() => {
    entry.untrackTimer = null;
    entry.desiredTrack = null;
    flushTrack(entry);
  }, UNTRACK_DELAY_MS);
}

function setTrack(entry: Entry, me: LobbyPresence | null) {
  if (me) {
    if (entry.untrackTimer) {
      clearTimeout(entry.untrackTimer);
      entry.untrackTimer = null;
    }
    entry.desiredTrack = me;
    flushTrack(entry);
    return;
  }
  if (!entry.tracked) {
    // Nothing on the server yet: just cancel any pending track (observers land here too).
    entry.desiredTrack = null;
    return;
  }
  // A brief null (e.g. a page mounting before it knows its phase) must not cost an untrack + re-track
  // pair against the presence rate limit: defer it, so a real payload arriving soon replaces it.
  if (!entry.untrackTimer) scheduleUntrack(entry);
}

function waitSubscribed(entry: Entry, timeoutMs: number): Promise<boolean> {
  if (entry.subscribed) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      entry.subscribedWaiters.delete(done);
      resolve(false);
    }, timeoutMs);
    entry.subscribedWaiters.add(done);
  });
}

/* ------------------------------------------------------------------------------------------------
 * Hooks
 * ---------------------------------------------------------------------------------------------- */

/**
 * Joins Realtime channel "lobby:<CODE>" (presence key = me.playerId; me=null => observe only),
 * re-tracks when `me` changes (throttled), returns everyone sorted by joinedAt. No-op when code is null.
 */
export function useLobbyPresence(
  code: string | null,
  me: LobbyPresence | null,
): { players: LobbyPresence[]; connected: boolean } {
  const meKey = me ? JSON.stringify(me) : null;
  const presenceKey = me?.playerId ?? null;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!code) return () => undefined;
      const entry = acquire(code, presenceKey);
      entry.storeListeners.add(onChange);
      return () => {
        entry.storeListeners.delete(onChange);
        release(entry);
      };
    },
    [code, presenceKey],
  );
  const getSnapshot = useCallback(() => (code ? (registry.get(code)?.snapshot ?? EMPTY_SNAPSHOT) : EMPTY_SNAPSHOT), [code]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);

  useEffect(() => {
    if (!code) return;
    const entry = acquire(code, presenceKey);
    const parsed = meKey ? (JSON.parse(meKey) as LobbyPresence) : null;
    setTrack(entry, parsed);
    return () => {
      // Deferred untrack: a re-run (me changed) or the next page acquiring this channel with a payload
      // cancels it, so others never see a leave/join flicker and no presence message is spent. On a
      // real unmount release() untracks / removes the channel, which drops our presence anyway.
      scheduleUntrack(entry);
      release(entry);
    };
  }, [code, meKey, presenceKey]);

  return snapshot;
}

/**
 * Initial getSession(code) + listens for broadcast "status" on "lobby:<CODE>" (verified against the
 * server before use) + polls every 2s while status === "lobby" (10s otherwise) + refetches on focus.
 */
export function useSessionStatus(code: string | null): {
  session: SessionRow | null;
  loading: boolean;
  notFound: boolean;
} {
  const [state, setState] = useState<{ key: string | null; session: SessionRow | null; notFound: boolean; done: boolean }>({
    key: null,
    session: null,
    notFound: false,
    done: false,
  });

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let again = false;
    let lastStatus: SessionStatus | null = null;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), ms);
    };

    const load = async (): Promise<void> => {
      if (cancelled) return;
      if (inFlight) {
        again = true;
        return;
      }
      inFlight = true;
      let nextDelay = 2000;
      try {
        const session = await getSession(code);
        if (cancelled) return;
        lastStatus = session?.status ?? null;
        setState((prev) => {
          if (prev.key === code && prev.done && prev.notFound === (session === null) && sameSession(prev.session, session)) {
            return prev;
          }
          return { key: code, session, notFound: session === null, done: true };
        });
        nextDelay = session && session.status !== "lobby" ? 10_000 : session ? 2000 : 5000;
      } catch {
        if (cancelled) return;
        setState((s) => (s.key === code && s.done ? s : { key: code, session: s.key === code ? s.session : null, notFound: false, done: true }));
        // Errors (incl. 429 when a whole room shares one IP) retry after a jittered 3-6s so rejected
        // clients don't all refill the window in lockstep.
        nextDelay = lastStatus && lastStatus !== "lobby" ? 10_000 : 3000 + Math.floor(Math.random() * 3000);
      } finally {
        inFlight = false;
      }
      if (cancelled) return;
      if (again) {
        again = false;
        schedule(0);
      } else {
        schedule(nextDelay);
      }
    };

    // Realtime: a "status" broadcast triggers an immediate server check (never trust the payload alone).
    const entry = acquire(code);
    const onStatus = () => void load();
    entry.statusListeners.add(onStatus);

    const onFocus = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    void load();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      entry.statusListeners.delete(onStatus);
      release(entry);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code]);

  if (!code) return { session: null, loading: false, notFound: false };
  const current = state.key === code;
  return {
    session: current ? state.session : null,
    loading: !current || !state.done,
    notFound: current && state.notFound,
  };
}

/**
 * Host calls this after a start/end/reset API success. Notifies this page's own listeners immediately
 * and broadcasts "status" to every client on "lobby:<CODE>" (websocket, REST fallback). Never throws:
 * clients also poll, so a missed broadcast only costs a couple of seconds.
 */
export async function broadcastSessionStatus(code: string, status: SessionStatus): Promise<void> {
  const norm = code.toUpperCase();
  const payload = { status, startedAt: status === "playing" ? new Date().toISOString() : null };
  const entry = acquire(norm);
  try {
    for (const l of entry.statusListeners) l(payload);
    const ok = await waitSubscribed(entry, 4000);
    const ch = entry.channel;
    if (!ch) return;
    if (ok) {
      await ch.send({ type: "broadcast", event: "status", payload });
    } else {
      await ch.httpSend("status", payload);
    }
  } catch {
    // best effort
  } finally {
    release(entry);
  }
}
