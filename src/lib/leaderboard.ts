// Leaderboard data: pure helpers + a realtime hook over public.runs.
// Browser selects always list columns explicitly.
import { useEffect, useState } from "react";
import { compareRuns, playerKey } from "./leaderboard-core";
import { getBrowserSupabase } from "./supabase/browser";
import type { AKey, AStats, RunRow } from "./types";

export { bestRunPerPlayer, compareRuns, playerKey, type RankableRun } from "./leaderboard-core";

export const RUN_COLUMNS =
  "id, session_code, player_name, score, floors_cleared, total_floors, hearts_left, duration_ms, outcome, a_stats, avatar, player_id, created_at";

export const A_KEYS: readonly AKey[] = ["assist", "actionable", "appreciate", "acceptOrDecline"];

export type LiveStatus = "connecting" | "live" | "offline";

export interface LiveRuns {
  /** All fetched runs for the scope, sorted by score desc then created_at asc (not deduped). */
  runs: RunRow[];
  status: LiveStatus;
  loading: boolean;
  error: string | null;
  /** Ids of runs that arrived via realtime in the last few seconds. */
  freshIds: readonly string[];
}

const FRESH_MS = 4_000;
const SUPABASE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

// ---------- pure helpers ----------

function toCount(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function emptyAStats(): AStats {
  return {
    assist: { correct: 0, total: 0 },
    actionable: { correct: 0, total: 0 },
    appreciate: { correct: 0, total: 0 },
    acceptOrDecline: { correct: 0, total: 0 },
  };
}

/** Coerces an untrusted row (e.g. a realtime payload) into a RunRow. */
export function normalizeRunRow(input: unknown): RunRow | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const stats = emptyAStats();
  const rawStats = (r.a_stats && typeof r.a_stats === "object" ? r.a_stats : {}) as Record<string, unknown>;
  for (const a of A_KEYS) {
    const s = (rawStats[a] && typeof rawStats[a] === "object" ? rawStats[a] : {}) as Record<string, unknown>;
    const total = toCount(s.total);
    stats[a] = { correct: Math.min(toCount(s.correct), total), total };
  }
  return {
    id: r.id,
    session_code: typeof r.session_code === "string" ? r.session_code : null,
    player_name: typeof r.player_name === "string" ? r.player_name : "Unknown hero",
    score: toCount(r.score),
    floors_cleared: toCount(r.floors_cleared),
    total_floors: toCount(r.total_floors) || 12,
    hearts_left: toCount(r.hearts_left),
    duration_ms: toCount(r.duration_ms),
    outcome: r.outcome === "victory" ? "victory" : "doomed",
    a_stats: stats,
    avatar: typeof r.avatar === "string" ? r.avatar : null,
    player_id: typeof r.player_id === "string" && r.player_id ? r.player_id : null,
    created_at: typeof r.created_at === "string" ? r.created_at : new Date(0).toISOString(),
  };
}

/** Sums a_stats across runs. */
export function aggregateAStats(rows: readonly RunRow[]): AStats {
  const total = emptyAStats();
  for (const row of rows) {
    for (const a of A_KEYS) {
      total[a].correct += row.a_stats?.[a]?.correct ?? 0;
      total[a].total += row.a_stats?.[a]?.total ?? 0;
    }
  }
  return total;
}

/** The A with the lowest accuracy (ignoring A's never attempted). */
export function weakestA(stats: AStats): AKey | null {
  let worst: AKey | null = null;
  let worstRatio = Infinity;
  for (const a of A_KEYS) {
    const { correct, total } = stats[a];
    if (total <= 0) continue;
    const ratio = correct / total;
    if (ratio < worstRatio) {
      worst = a;
      worstRatio = ratio;
    }
  }
  return worst;
}

export interface RunSummary {
  runs: number;
  players: number;
  victories: number;
  /** 0-1 */
  victoryRate: number;
  avgScore: number;
  bestScore: number;
}

export function summarizeRuns(rows: readonly RunRow[]): RunSummary {
  const players = new Set(rows.map(playerKey)).size;
  const victories = rows.filter((r) => r.outcome === "victory").length;
  const sum = rows.reduce((acc, r) => acc + r.score, 0);
  return {
    runs: rows.length,
    players,
    victories,
    victoryRate: rows.length ? victories / rows.length : 0,
    avgScore: rows.length ? Math.round(sum / rows.length) : 0,
    bestScore: rows.reduce((m, r) => Math.max(m, r.score), 0),
  };
}

function mergeRows(existing: readonly RunRow[], incoming: readonly RunRow[], max: number): RunRow[] {
  const byId = new Map<string, RunRow>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of incoming) byId.set(r.id, r);
  return [...byId.values()].sort(compareRuns).slice(0, max);
}

// ---------- realtime hook ----------

interface State {
  scope: string | null;
  rows: RunRow[];
  status: LiveStatus;
  loaded: boolean;
  error: string | null;
  fresh: string[];
}

function emptyState(scope: string | null): State {
  return { scope, rows: [], status: "connecting", loaded: false, error: null, fresh: [] };
}

/**
 * Loads runs for a session (or globally when sessionCode is null) and keeps them live via
 * postgres_changes INSERT on public.runs. Subscribe once per view and share the result.
 */
export function useLiveRuns(sessionCode: string | null, options: { max?: number } = {}): LiveRuns {
  const max = options.max ?? (sessionCode ? 1000 : 300);
  const scope = sessionCode ?? "*";
  const [state, setState] = useState<State>(() => emptyState(null));

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const supabase = getBrowserSupabase();
    const base = (s: State) => (s.scope === scope ? s : emptyState(scope));

    const load = async () => {
      let query = supabase
        .from("runs")
        .select(RUN_COLUMNS)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(max);
      if (sessionCode) query = query.eq("session_code", sessionCode);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setState((s) => ({ ...base(s), loaded: true, error: "Could not load the scores. Retrying when the connection returns." }));
        return;
      }
      const rows = (data ?? []).map(normalizeRunRow).filter((r): r is RunRow => r !== null);
      setState((s) => {
        const b = base(s);
        return { ...b, rows: mergeRows(b.rows, rows, max), loaded: true, error: null };
      });
    };

    const channel = supabase
      .channel(`runs:${scope}:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "runs",
          ...(sessionCode ? { filter: `session_code=eq.${sessionCode}` } : {}),
        },
        (payload) => {
          const row = normalizeRunRow(payload.new);
          if (!row || cancelled) return;
          if (sessionCode && row.session_code !== sessionCode) return;
          setState((s) => {
            const b = base(s);
            if (b.rows.some((r) => r.id === row.id)) return b;
            return { ...b, rows: mergeRows(b.rows, [row], max), fresh: [...b.fresh, row.id] };
          });
          const timer = setTimeout(() => {
            timers.delete(timer);
            setState((s) => (s.scope === scope ? { ...s, fresh: s.fresh.filter((id) => id !== row.id) } : s));
          }, FRESH_MS);
          timers.add(timer);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setState((s) => ({ ...base(s), status: "live" }));
          void load(); // refill anything missed while (re)connecting
          // postgres_changes can take a few seconds to start streaming after SUBSCRIBED: re-sync once more.
          const resync = setTimeout(() => {
            timers.delete(resync);
            void load();
          }, 5_000);
          timers.add(resync);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setState((s) => ({ ...base(s), status: "offline" }));
        }
      });

    void load();

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      void supabase.removeChannel(channel);
    };
  }, [scope, sessionCode, max]);

  if (!SUPABASE_CONFIGURED) {
    return { runs: [], status: "offline", loading: false, error: "The leaderboard is not configured.", freshIds: [] };
  }
  if (state.scope !== scope) {
    return { runs: [], status: "connecting", loading: true, error: null, freshIds: [] };
  }
  return { runs: state.rows, status: state.status, loading: !state.loaded, error: state.error, freshIds: state.fresh };
}
