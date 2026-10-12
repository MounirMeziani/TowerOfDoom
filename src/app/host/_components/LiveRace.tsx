"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { HeroAvatar } from "@/components/character/HeroAvatar";
import { BOSS_FLOORS, TOTAL_FLOORS } from "@/lib/game/constants";
import type { LobbyPresence } from "@/lib/types";

const MAX_PER_ROW = 10;

type RowId = "summit" | "ground" | number;

interface Placed {
  player: LobbyPresence;
  fallen: boolean;
  victor: boolean;
}

function placePlayer(p: LobbyPresence): { row: RowId; placed: Placed } {
  const floor = typeof p.floor === "number" && Number.isFinite(p.floor) ? Math.round(p.floor) : null;
  if (p.phase === "finished") {
    const fallen = typeof p.hearts === "number" && p.hearts <= 0;
    if (!fallen) return { row: "summit", placed: { player: p, fallen: false, victor: true } };
    const row = floor ? Math.min(TOTAL_FLOORS, Math.max(1, floor)) : "ground";
    return { row, placed: { player: p, fallen: true, victor: false } };
  }
  if (p.phase === "playing") {
    return { row: Math.min(TOTAL_FLOORS, Math.max(1, floor ?? 1)), placed: { player: p, fallen: false, victor: false } };
  }
  return { row: "ground", placed: { player: p, fallen: false, victor: false } };
}

/** A tall tower with 12 floors; every present hero sits on the floor they are currently fighting. */
export function LiveRace({ players, ended = false }: { players: LobbyPresence[]; ended?: boolean }) {
  const reduce = useReducedMotion();
  const rows = new Map<RowId, Placed[]>();
  for (const p of players) {
    const { row, placed } = placePlayer(p);
    const list = rows.get(row) ?? [];
    list.push(placed);
    rows.set(row, list);
  }
  const rowOrder: RowId[] = ["summit", ...Array.from({ length: TOTAL_FLOORS }, (_, i) => TOTAL_FLOORS - i), "ground"];
  const climbing = players.filter((p) => p.phase === "playing").length;
  const victors = rows.get("summit")?.length ?? 0;

  return (
    <section aria-labelledby="race-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="race-heading" className="font-pixel text-sm uppercase text-ember-2 xl:text-base">
          {ended ? "Final positions" : "Live race"}
        </h2>
        <p className="text-sm text-muted">
          {!(ended && climbing === 0) && (
            <>
              <span className="font-pixel text-xs text-text xl:text-sm">{climbing}</span>{" "}
              {ended ? "still finishing" : "climbing"} ·{" "}
            </>
          )}
          <span className="font-pixel text-xs text-gold xl:text-sm">{victors}</span> at the summit
        </p>
      </div>

      <LayoutGroup id="race">
        <ol
          aria-label="Tower floors, top to bottom"
          className="relative flex flex-col overflow-hidden rounded-t-[2rem] border-2 border-line bg-surface shadow-[inset_0_-60px_80px_-40px_rgb(255_107_44/0.35)]"
        >
          {rowOrder.map((row) => {
            const list = rows.get(row) ?? [];
            const shown = list.slice(0, MAX_PER_ROW);
            const extra = list.length - shown.length;
            const boss = typeof row === "number" ? (BOSS_FLOORS as Record<number, "giving" | "receiving">)[row] : undefined;
            const label =
              row === "summit" ? "Summit" : row === "ground" ? "Lobby" : `Floor ${row}${boss ? `, ${boss} boss` : ""}`;

            return (
              <li
                key={String(row)}
                aria-label={`${label}: ${list.length} ${list.length === 1 ? "hero" : "heroes"}`}
                className={`flex min-h-12 items-center gap-3 border-b border-line/70 px-3 py-1.5 last:border-b-0 xl:min-h-16 xl:px-4 xl:py-2 ${
                  row === "summit"
                    ? "bg-gold/10"
                    : row === "ground"
                      ? "bg-bg/60"
                      : boss === "giving"
                        ? "bg-giving/10"
                        : boss === "receiving"
                          ? "bg-receiving/10"
                          : typeof row === "number" && row % 2 === 0
                            ? "bg-surface-2/50"
                            : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex w-16 shrink-0 flex-col font-pixel text-[0.625rem] leading-tight xl:w-20 xl:text-xs ${
                    row === "summit"
                      ? "text-gold"
                      : boss === "giving"
                        ? "text-giving"
                        : boss === "receiving"
                          ? "text-receiving"
                          : "text-muted"
                  }`}
                >
                  {row === "summit" ? "👑 TOP" : row === "ground" ? "LOBBY" : `F${row}`}
                  {boss && <span className="mt-0.5 text-[0.625rem]">BOSS</span>}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-1 xl:gap-x-3">
                  {shown.map(({ player, fallen, victor }) => (
                    <motion.div
                      key={player.playerId}
                      layoutId={reduce ? undefined : `race-${player.playerId}`}
                      layout={reduce ? false : "position"}
                      transition={{ type: "spring", stiffness: 260, damping: 26 }}
                      className="relative flex w-14 flex-col items-center gap-0.5 xl:w-20"
                      title={`${player.name}${typeof player.score === "number" ? ` · ${player.score} pts` : ""}`}
                    >
                      <span className={fallen ? "opacity-50 grayscale" : ""}>
                        <span className="flex xl:hidden">
                          <HeroAvatar heroId={player.heroId} size="sm" />
                        </span>
                        <span className="hidden xl:flex">
                          <HeroAvatar heroId={player.heroId} size="md" />
                        </span>
                      </span>
                      {(fallen || victor) && (
                        <span aria-hidden="true" className="absolute -top-2 -right-0.5 text-sm xl:text-base">
                          {victor ? "👑" : "💀"}
                        </span>
                      )}
                      <span className="w-full truncate text-center text-[0.625rem] leading-tight text-text/90 xl:text-sm">
                        {player.name}
                      </span>
                    </motion.div>
                  ))}
                  {extra > 0 && <span className="self-center font-pixel text-[0.625rem] text-muted xl:text-xs">+{extra}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </LayoutGroup>
      {players.length === 0 && (
        <p className="text-sm text-muted">
          {ended
            ? "The session has ended. Every finished run is on the leaderboard."
            : "No heroes are connected right now. Results still land on the leaderboard."}
        </p>
      )}
    </section>
  );
}
