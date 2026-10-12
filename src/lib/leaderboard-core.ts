// Pure leaderboard ranking helpers, safe to import on the server (no React, no Supabase client).
// src/lib/leaderboard.ts re-exports these for the browser views.
import type { RunRow } from "./types";

/** The fields ranking needs. Full RunRows satisfy it, and so do the narrow rows the runs API selects. */
export type RankableRun = Pick<RunRow, "player_name" | "score" | "created_at"> & { player_id?: string | null };

/** Score desc, then earliest first. */
export function compareRuns(a: RankableRun, b: RankableRun): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * Identity of the player behind a run: the stable player id when the run has one, else the
 * case-insensitive name (legacy rows). Both branches are prefixed so an id can't collide with a name.
 */
export function playerKey(row: RankableRun): string {
  return row.player_id ? `id:${row.player_id}` : `name:${row.player_name.trim().toLowerCase()}`;
}

/** Best run per player (id, falling back to name for legacy rows), sorted score desc then earliest first. */
export function bestRunPerPlayer<T extends RankableRun>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const row of rows) {
    const key = playerKey(row);
    const cur = best.get(key);
    if (!cur || compareRuns(row, cur) < 0) best.set(key, row);
  }
  return [...best.values()].sort(compareRuns);
}
