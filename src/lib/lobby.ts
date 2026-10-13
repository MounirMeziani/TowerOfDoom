// Lobby realtime: Supabase Realtime Broadcast on channel "lobby:<CODE>" (roster via "who" beacons;
// Presence is kept behind USE_PRESENCE, see below).
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
  return finalizePlayers(presenceById(state).values());
}

type TimedPresence = LobbyPresence & { _ts: number };

function presenceById(state: Record<string, unknown>): Map<string, TimedPresence> {
  const byId = new Map<string, TimedPresence>();
  for (const metas of Object.values(state ?? {})) {
    if (!Array.isArray(metas)) continue;
    for (const meta of metas) {
      const p = parseLobbyPresence(meta);
      if (!p) continue;
      const prev = byId.get(p.playerId);
      if (!prev || p._ts >= prev._ts) byId.set(p.playerId, p);
    }
  }
  return byId;
}

function finalizePlayers(list: Iterable<TimedPresence>): LobbyPresence[] {
  return [...list]
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
  // persistent: called on every (re)subscribe, e.g. so motion-sync can publish immediately
  subscribeListeners: Set<() => void>;
  // relayed broadcast events (see RELAYED_EVENTS) -> listeners
  broadcastListeners: Map<string, Set<(payload: unknown) => void>>;
  // presence tracking (one tracked payload per channel; last writer wins)
  desiredTrack: LobbyPresence | null;
  tracked: boolean;
  lastTrackAt: number;
  trackTimer: ReturnType<typeof setTimeout> | null;
  untrackTimer: ReturnType<typeof setTimeout> | null;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  // roster beacons ("who" broadcasts): a fallback for Supabase presence, which can miss joins
  presence: Map<string, TimedPresence>;
  beacons: Map<string, { p: TimedPresence; at: number }>;
  desiredTs: number;
  lastBeaconAt: number;
  beaconTimer: ReturnType<typeof setTimeout> | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  // Supabase can crash the channel process right after a presence track ("channel_crash"), and the
  // rejoin re-tracks and crashes again, leaving the client dark. After two crashes that follow a
  // track, stop using presence on this channel and rely on beacons alone.
  crashes: number;
  presenceOff: boolean;
  // A server-closed channel (e.g. "Too many messages per second") is terminal in realtime-js: we
  // remove it and create a fresh one after a jittered exponential backoff.
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelay: number;
  // Date.now() until which the server recently complained about our message rate (senders back off).
  throttledUntil: number;
  // called when another client says "hello" (just (re)joined), e.g. so motion-sync re-sends soon
  helloListeners: Set<() => void>;
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

// Extra broadcast events relayed to acquireLobbyChannel() listeners ("pos" = motion-sync positions).
// Bindings are registered once per channel, before subscribe.
const RELAYED_EVENTS = ["pos"] as const;

// Roster beacons. Supabase presence can silently miss joins (observed: a client's presence_state
// lacks players who tracked seconds earlier, and no presence_diff ever follows), so every tracked
// client also broadcasts its presence payload as "who": on join, on change, when asked ("hello") and
// periodically. The roster is presence + fresh beacons. The interval scales with the roster so the
// message budget stays flat.
const BEACON_EVENT = "who";
// Supabase presence is currently off: on this project, presence-enabled channels hit server-side
// "channel_crash" errors (reproduced with plain supabase-js clients and trivial payloads), and every
// crash/rejoin leaves the client unable to send or receive for seconds. Broadcast-only channels are
// reliable, so the roster runs on beacons alone. Flip to true to use presence + beacons again.
const USE_PRESENCE = false;
const BEACON_MIN_GAP_MS = 1500;
const BEACON_TICK_MS = 1000;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15_000;
// After a "Too many messages per second" system error, senders double their intervals this long.
const THROTTLE_BACKOFF_MS = 30_000;
export function beaconInterval(rosterSize: number): number {
  return Math.max(5000, rosterSize * 500);
}
export function beaconStaleMs(rosterSize: number): number {
  return Math.max(20_000, beaconInterval(rosterSize) * 3 + 2000);
}
export type RelayedLobbyEvent = (typeof RELAYED_EVENTS)[number];

const registry = new Map<string, Entry>();

// Tab closing / navigating away: say goodbye so the roster drops us now rather than after the stale timeout.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const entry of registry.values()) {
      const me = entry.desiredTrack;
      const ch = entry.channel;
      if (!me || !ch || !entry.subscribed) continue;
      try {
        void ch.send({ type: "broadcast", event: BEACON_EVENT, payload: { playerId: me.playerId, bye: true } }).catch(() => undefined);
      } catch {
        // best effort
      }
    }
  });
}
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

/** players = presence + fresh beacons + self (newest _ts wins per player). */
function recompute(entry: Entry) {
  const now = Date.now();
  const stale = beaconStaleMs(entry.snapshot.players.length);
  const byId = new Map(entry.presence);
  for (const [id, b] of entry.beacons) {
    if (now - b.at > stale) {
      entry.beacons.delete(id);
      continue;
    }
    const prev = byId.get(id);
    if (!prev || b.p._ts >= prev._ts) byId.set(id, b.p);
  }
  const me = entry.desiredTrack;
  if (me && entry.subscribed) {
    const prev = byId.get(me.playerId);
    if (!prev || entry.desiredTs >= prev._ts) byId.set(me.playerId, { ...me, _ts: entry.desiredTs });
  }
  emit(entry, { players: finalizePlayers(byId.values()) });
}

function sendBeacon(entry: Entry, extra?: Record<string, unknown>) {
  const ch = entry.channel;
  if (!ch || !entry.subscribed) return;
  const me = entry.desiredTrack;
  if (!me && !extra) return;
  if (me) entry.lastBeaconAt = Date.now();
  const payload = me ? { ...me, _ts: entry.desiredTs, ...extra } : { ...extra };
  try {
    void ch.send({ type: "broadcast", event: BEACON_EVENT, payload }).catch(() => undefined);
  } catch {
    // best effort
  }
}

/** Beacon soon (coalesced, at most every BEACON_MIN_GAP_MS). `jitter` spreads replies to a hello. */
function scheduleBeacon(entry: Entry, jitter = 0) {
  if (!entry.desiredTrack || entry.beaconTimer) return;
  const gap = Math.max(0, entry.lastBeaconAt + BEACON_MIN_GAP_MS - Date.now());
  const wait = gap + (jitter ? Math.floor(Math.random() * jitter) : 0);
  entry.beaconTimer = setTimeout(() => {
    entry.beaconTimer = null;
    sendBeacon(entry);
  }, wait);
}

function onBeacon(entry: Entry, raw: unknown) {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.hello === true) {
    scheduleBeacon(entry, 800);
    for (const l of entry.helloListeners) l();
  }
  if (typeof r.playerId === "string" && r.bye === true) {
    if (entry.beacons.delete(r.playerId)) recompute(entry);
    return;
  }
  const p = parseLobbyPresence(raw);
  if (!p) return;
  if (entry.desiredTrack && p.playerId === entry.desiredTrack.playerId) return; // our own id in another tab
  const known = entry.beacons.has(p.playerId) || entry.presence.has(p.playerId);
  entry.beacons.set(p.playerId, { p, at: Date.now() });
  // a newcomer may have missed us in presence: introduce ourselves
  if (!known) scheduleBeacon(entry, 800);
  recompute(entry);
}

function startTick(entry: Entry) {
  if (entry.tickTimer) return;
  entry.tickTimer = setInterval(() => {
    if (!entry.subscribed) return;
    const now = Date.now();
    const every = beaconInterval(entry.snapshot.players.length) * (entry.throttledUntil > now ? 2 : 1);
    if (entry.desiredTrack && now - entry.lastBeaconAt >= every) {
      sendBeacon(entry);
    }
    if (entry.beacons.size) recompute(entry);
  }, BEACON_TICK_MS);
}

function stopTimers(entry: Entry) {
  for (const t of [entry.trackTimer, entry.untrackTimer, entry.beaconTimer]) if (t) clearTimeout(t);
  entry.trackTimer = entry.untrackTimer = entry.beaconTimer = null;
  if (entry.tickTimer) clearInterval(entry.tickTimer);
  entry.tickTimer = null;
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
  if (entry.presenceOff) return;
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
    config: { presence: { key, enabled: USE_PRESENCE }, broadcast: { self: false, ack: false } },
  });
  entry.channel = channel;
  entry.creating = false;

  const sync = () => {
    entry.presence = presenceById(channel.presenceState() as Record<string, unknown>);
    recompute(entry);
  };
  // (binding a presence listener would make supabase-js enable presence on the join)
  if (USE_PRESENCE) {
    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync);
  }
  channel
    .on("broadcast", { event: "status" }, (msg: { payload?: unknown }) => {
      const p = (msg?.payload ?? {}) as Record<string, unknown>;
      if (!isSessionStatus(p.status)) return;
      const message: StatusMessage = {
        status: p.status,
        startedAt: typeof p.startedAt === "string" ? p.startedAt : null,
      };
      for (const l of entry.statusListeners) l(message);
    })
    .on("broadcast", { event: BEACON_EVENT }, (msg: { payload?: unknown }) => onBeacon(entry, msg?.payload))
    .on("system", {}, (m: unknown) => {
      const text = String((m as { message?: unknown } | null)?.message ?? "");
      if (/too many messages/i.test(text)) entry.throttledUntil = Date.now() + THROTTLE_BACKOFF_MS;
    });
  for (const event of RELAYED_EVENTS) {
    channel.on("broadcast", { event }, (msg: { payload?: unknown }) => {
      const set = entry.broadcastListeners.get(event);
      if (!set) return;
      for (const l of set) l(msg?.payload);
    });
  }
  channel
    .subscribe((status) => {
      if (entry.channel !== channel) return;
      if (status === "SUBSCRIBED") {
        entry.subscribed = true;
        entry.retryDelay = RETRY_BASE_MS;
        entry.lastTrackAt = 0;
        emit(entry, { connected: true });
        for (const w of entry.subscribedWaiters) w();
        entry.subscribedWaiters.clear();
        flushTrack(entry);
        // introduce ourselves and ask everyone else to do the same (covers missed presence joins)
        sendBeacon(entry, { hello: true });
        recompute(entry);
        startTick(entry);
        for (const l of entry.subscribeListeners) l();
      } else {
        // CHANNEL_ERROR / TIMED_OUT: realtime-js rejoins on its own. CLOSED is terminal (e.g. the
        // server closed us for "Too many messages per second"): recoverChannel builds a new channel.
        if (status === "CHANNEL_ERROR" && entry.tracked) {
          entry.crashes += 1;
          if (entry.crashes >= 2 && !entry.presenceOff) {
            entry.presenceOff = true;
            console.warn("[lobby] presence disabled after repeated channel errors; using beacons");
          }
        }
        entry.tracked = false; // the server dropped our presence with the channel process
        entry.subscribed = false;
        emit(entry, { connected: false });
        if (status === "CLOSED" && entry.refs > 0 && registry.get(entry.code) === entry) recoverChannel(entry, channel);
      }
    });
}

/**
 * The server closed this channel while we still need it: drop it and create a fresh one after a
 * jittered exponential backoff (1s, 2s, 4s ... 15s; reset on SUBSCRIBED). The removed channel's own
 * CLOSED callback is a no-op because entry.channel no longer points at it.
 */
function recoverChannel(entry: Entry, ch: RealtimeChannel) {
  stopTimers(entry);
  entry.channel = null;
  entry.subscribed = false;
  entry.tracked = false;
  entry.presence = new Map();
  const removal = Promise.resolve()
    .then(() => getBrowserSupabase().removeChannel(ch))
    .catch(() => undefined);
  const tracked = removal.finally(() => {
    if (pendingRemovals.get(entry.code) === tracked) pendingRemovals.delete(entry.code);
  });
  pendingRemovals.set(entry.code, tracked);
  if (entry.retryTimer) return;
  const delay = entry.retryDelay * (1 + Math.random());
  entry.retryDelay = Math.min(entry.retryDelay * 2, RETRY_MAX_MS);
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (entry.refs <= 0 || registry.get(entry.code) !== entry || entry.channel || entry.creating) return;
    entry.creating = true;
    void createChannel(entry);
  }, delay);
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
      subscribeListeners: new Set(),
      broadcastListeners: new Map(),
      desiredTrack: null,
      tracked: false,
      lastTrackAt: 0,
      trackTimer: null,
      untrackTimer: null,
      teardownTimer: null,
      presence: new Map(),
      beacons: new Map(),
      desiredTs: 0,
      lastBeaconAt: 0,
      beaconTimer: null,
      tickTimer: null,
      crashes: 0,
      presenceOff: !USE_PRESENCE,
      retryTimer: null,
      retryDelay: RETRY_BASE_MS,
      throttledUntil: 0,
      helloListeners: new Set(),
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
    const me = entry.desiredTrack;
    if (me) sendBeacon(entry, { playerId: me.playerId, bye: true });
    stopTimers(entry);
    if (entry.retryTimer) clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
    entry.subscribedWaiters.clear();
    entry.helloListeners.clear();
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
    const me = entry.desiredTrack;
    const ch = entry.channel;
    if (me && ch && entry.subscribed) {
      void ch.send({ type: "broadcast", event: BEACON_EVENT, payload: { playerId: me.playerId, bye: true } }).catch(() => undefined);
    }
    entry.desiredTrack = null;
    flushTrack(entry);
    recompute(entry);
  }, UNTRACK_DELAY_MS);
}

function setTrack(entry: Entry, me: LobbyPresence | null) {
  if (me) {
    if (entry.untrackTimer) {
      clearTimeout(entry.untrackTimer);
      entry.untrackTimer = null;
    }
    const changed = !entry.desiredTrack || JSON.stringify(entry.desiredTrack) !== JSON.stringify(me);
    entry.desiredTrack = me;
    if (changed) entry.desiredTs = Date.now();
    flushTrack(entry);
    if (changed) {
      scheduleBeacon(entry);
      recompute(entry);
    }
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
 * Shared channel handle (for features that ride on the same "lobby:<CODE>" topic, e.g. motion-sync)
 * ---------------------------------------------------------------------------------------------- */

export interface LobbyChannelHandle {
  readonly code: string;
  /** true while the shared channel is joined. */
  isSubscribed(): boolean;
  /** Number of players currently in presence on this channel. */
  rosterSize(): number;
  /** Broadcast over the websocket; returns false (and sends nothing) while not subscribed. */
  send(event: RelayedLobbyEvent, payload: Record<string, unknown>): boolean;
  /** Listen to a relayed broadcast event from other clients (self is never echoed). */
  onBroadcast(event: RelayedLobbyEvent, fn: (payload: unknown) => void): () => void;
  /** Called on every (re)subscribe; also immediately if already subscribed. */
  onSubscribed(fn: () => void): () => void;
  /** Called whenever the presence roster (or connection state) changes. */
  onRosterChange(fn: () => void): () => void;
  /** Called when another client announces itself with a "hello" beacon (it just (re)joined). */
  onHello(fn: () => void): () => void;
  /** True while the server recently complained about our message rate: senders should slow down. */
  isThrottled(): boolean;
  /** Drop this reference (idempotent). Listeners added through this handle are removed. */
  release(): void;
}

/**
 * Ref-counted access to the shared "lobby:<CODE>" channel without opening a second channel on the
 * same topic. presenceKey should be the player's id when known (null for observers).
 */
export function acquireLobbyChannel(code: string, presenceKey?: string | null): LobbyChannelHandle {
  const norm = code.toUpperCase();
  const entry = acquire(norm, presenceKey ?? null);
  const cleanups = new Set<() => void>();
  let released = false;
  const track = (fn: () => void) => {
    cleanups.add(fn);
    return () => {
      if (!cleanups.delete(fn)) return;
      fn();
    };
  };
  return {
    code: norm,
    isSubscribed: () => entry.subscribed && !!entry.channel,
    rosterSize: () => entry.snapshot.players.length,
    send(event, payload) {
      const ch = entry.channel;
      if (released || !ch || !entry.subscribed) return false;
      try {
        void ch.send({ type: "broadcast", event, payload }).catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    },
    onBroadcast(event, fn) {
      if (released) return () => undefined;
      let set = entry.broadcastListeners.get(event);
      if (!set) {
        set = new Set();
        entry.broadcastListeners.set(event, set);
      }
      const s = set;
      s.add(fn);
      return track(() => s.delete(fn));
    },
    onSubscribed(fn) {
      if (released) return () => undefined;
      entry.subscribeListeners.add(fn);
      if (entry.subscribed && entry.channel) queueMicrotask(() => {
        if (!released && entry.subscribeListeners.has(fn)) fn();
      });
      return track(() => entry.subscribeListeners.delete(fn));
    },
    onHello(fn) {
      if (released) return () => undefined;
      entry.helloListeners.add(fn);
      return track(() => entry.helloListeners.delete(fn));
    },
    isThrottled: () => entry.throttledUntil > Date.now(),
    onRosterChange(fn) {
      if (released) return () => undefined;
      entry.storeListeners.add(fn);
      return track(() => entry.storeListeners.delete(fn));
    },
    release() {
      if (released) return;
      released = true;
      for (const fn of cleanups) fn();
      cleanups.clear();
      release(entry);
    },
  };
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
