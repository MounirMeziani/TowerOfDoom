// Run submission shared by Game (fires the save as soon as a run finishes, whatever is rendered)
// and FinishedScreen (reads the same promise to show the save status / rank).
import { submitRun } from "@/lib/api";
import type { Player, RunSubmission } from "@/lib/types";
import { TOTAL_FLOORS } from "./constants";
import { durationMs, floorsCleared, type GameState } from "./engine";

export type SubmitResult = { id: string; rank: number | null };

// Module-level dedupe: StrictMode double effects, re-mounts and Game + FinishedScreen share one request per run.
const submissions = new Map<string, Promise<SubmitResult>>();

export function runKeyFor(player: Pick<Player, "id">, state: Pick<GameState, "startedAt">): string {
  return `${player.id}:${state.startedAt ?? 0}`;
}

export function buildRunSubmission(state: GameState, player: Player, sessionCode: string | null): RunSubmission {
  const victory = state.outcome === "victory";
  const cleared = floorsCleared(state);
  return {
    playerName: player.name,
    heroId: player.heroId,
    sessionCode,
    score: state.score,
    floorsCleared: victory ? TOTAL_FLOORS : Math.min(TOTAL_FLOORS, cleared),
    totalFloors: TOTAL_FLOORS,
    heartsLeft: state.hearts,
    durationMs: durationMs(state),
    outcome: victory ? "victory" : "doomed",
    aStats: state.aStats,
    playerId: player.id,
  };
}

/** Submits a run once per key. A failed attempt is forgotten so a retry sends a new request. */
export function submitOnce(key: string, run: RunSubmission): Promise<SubmitResult> {
  let p = submissions.get(key);
  if (!p) {
    const created = submitRun(run);
    p = created;
    submissions.set(key, created);
    created.catch(() => {
      if (submissions.get(key) === created) submissions.delete(key);
    });
  }
  return p;
}
