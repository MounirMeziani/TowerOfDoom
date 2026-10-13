"use client";

// Projector view during the climb: 12-floor tower cutaway with every hero on their floor.
// Client-only: load with next/dynamic({ ssr: false }).

import { useEffect, useMemo, type ReactNode } from "react";
import { GameCanvas, resetDebug, setDebug } from "@/components/three/kit";
import { TowerCutaway, TowerCutawayCamera, type CutawayPlayer } from "@/components/three/world";
import { TOTAL_FLOORS } from "@/lib/game/constants";
import type { LobbyPresence, RunRow } from "@/lib/types";

export interface HostTower3DProps {
  players: LobbyPresence[];
  runs: RunRow[];
  /** ISO start of the current round; runs before it belong to an earlier round. */
  startedAt: string | null;
  /** Session ended: also place finished heroes who already left. */
  ended: boolean;
  overlay?: ReactNode;
}

function clampFloor(n: number | undefined, min: number): number {
  const f = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : min;
  return Math.min(TOTAL_FLOORS, Math.max(min, f));
}

/** Presence (live floor / phase) + this round's runs (outcome) -> cutaway tokens. */
export function toCutawayPlayers(
  players: LobbyPresence[],
  runs: RunRow[],
  startedAt: string | null,
  ended: boolean,
): CutawayPlayer[] {
  const since = startedAt ? Date.parse(startedAt) : NaN;
  const roundRuns = Number.isFinite(since) ? runs.filter((r) => Date.parse(r.created_at) >= since - 5_000) : runs;
  // Latest run per player id.
  const latest = new Map<string, RunRow>();
  for (const r of roundRuns) {
    if (!r.player_id) continue;
    const prev = latest.get(r.player_id);
    if (!prev || r.created_at > prev.created_at) latest.set(r.player_id, r);
  }

  const out: CutawayPlayer[] = [];
  const seen = new Set<string>();
  for (const p of players) {
    seen.add(p.playerId);
    if (p.phase !== "finished") {
      out.push({
        playerId: p.playerId,
        heroId: p.heroId,
        name: p.name,
        floor: p.phase === "playing" ? clampFloor(p.floor, 1) : 0,
        phase: p.phase,
      });
      continue;
    }
    const run = latest.get(p.playerId);
    const outcome: "victory" | "doomed" =
      run?.outcome ?? (typeof p.hearts === "number" && p.hearts <= 0 ? "doomed" : "victory");
    const floor = run ? clampFloor(run.floors_cleared + (outcome === "doomed" ? 1 : 0), 1) : clampFloor(p.floor, 1);
    out.push({ playerId: p.playerId, heroId: p.heroId, name: p.name, floor, phase: "finished", outcome });
  }

  if (ended) {
    for (const [id, r] of latest) {
      if (seen.has(id)) continue;
      out.push({
        playerId: id,
        heroId: r.avatar ?? "",
        name: r.player_name,
        floor: clampFloor(r.floors_cleared + (r.outcome === "doomed" ? 1 : 0), 1),
        phase: "finished",
        outcome: r.outcome,
      });
    }
  }
  return out;
}

export default function HostTower3D({ players, runs, startedAt, ended, overlay }: HostTower3DProps) {
  const tokens = useMemo(() => toCutawayPlayers(players, runs, startedAt, ended), [players, runs, startedAt, ended]);

  useEffect(() => {
    resetDebug("host", { remoteCount: 0 });
  }, []);
  useEffect(() => {
    setDebug({ scene: "host", remoteCount: tokens.length });
  }, [tokens.length]);

  return (
    <GameCanvas overlay={overlay} label={`Tower, ${tokens.length} heroes`}>
      <TowerCutawayCamera />
      <TowerCutaway players={tokens} />
    </GameCanvas>
  );
}
