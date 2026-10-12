"use client";

import Link from "next/link";
import { HeroAvatar } from "@/components/character/HeroAvatar";
import type { Floor } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { HeartsRow } from "./PixelHeart";

export interface HudProps {
  floors: Floor[];
  index: number;
  /** Number of floors already resolved (drives the tower fill). */
  cleared: number;
  hearts: number;
  maxHearts: number;
  score: number;
  streak: number;
  playerName: string;
  heroId: string;
  timeLimitMs: number;
  /** null hides the countdown (reveal / judging). */
  remainingMs: number | null;
}

/** Vertical mini tower: floor 1 at the bottom, bosses marked in gold. */
function TowerProgress({ floors, index, cleared }: { floors: Floor[]; index: number; cleared: number }) {
  return (
    <div
      className="flex h-12 w-4 shrink-0 flex-col-reverse gap-px rounded-[2px] border border-line bg-bg p-px"
      role="img"
      aria-label={`Floor ${Math.min(index + 1, floors.length)} of ${floors.length}`}
    >
      {floors.map((f, i) => {
        const isBoss = f.kind === "boss";
        const state = i < cleared ? "done" : i === index ? "current" : "todo";
        const bg =
          state === "current"
            ? "bg-ember shadow-[0_0_6px_var(--ember)]"
            : state === "done"
              ? isBoss
                ? "bg-gold"
                : "bg-good/80"
              : isBoss
                ? "bg-gold/30"
                : "bg-surface-2";
        return <span key={i} className={`block min-h-0 flex-1 rounded-[1px] ${bg}`} />;
      })}
    </div>
  );
}

function TimerBar({ remainingMs, limitMs }: { remainingMs: number | null; limitMs: number }) {
  const active = remainingMs !== null;
  const ratio = active ? Math.max(0, Math.min(1, remainingMs / limitMs)) : 1;
  const secs = active ? Math.ceil(Math.max(0, remainingMs) / 1000) : null;
  const urgent = active && remainingMs < 10_000;
  return (
    <div className="relative h-2 w-full bg-surface-2" aria-hidden={!active}>
      <div
        className={`h-full origin-left transition-[transform,background-color] duration-300 ease-linear ${
          active ? (urgent ? "bg-bad" : "bg-ember") : "bg-line"
        } ${urgent ? "animate-pulse" : ""}`}
        style={{ transform: `scaleX(${ratio})` }}
      />
      {secs !== null && (
        <span className="sr-only" role="timer" aria-live="off">
          {secs} seconds left
        </span>
      )}
    </div>
  );
}

export function Hud({
  floors,
  index,
  cleared,
  hearts,
  maxHearts,
  score,
  streak,
  playerName,
  heroId,
  timeLimitMs,
  remainingMs,
}: HudProps) {
  const floor = floors[index];
  const isBoss = floor?.kind === "boss";
  const secs = remainingMs !== null ? Math.ceil(Math.max(0, remainingMs) / 1000) : null;
  const urgent = remainingMs !== null && remainingMs < 10_000;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-bg/90 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2">
        <TowerProgress floors={floors} index={index} cleared={cleared} />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={`font-pixel text-[0.625rem] whitespace-nowrap sm:text-xs ${isBoss ? "text-gold" : "text-text"}`}
          >
            {isBoss ? "BOSS" : "FLOOR"} {Math.min(index + 1, floors.length)}/{floors.length}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <HeroAvatar heroId={heroId} size="sm" className="!size-6 !text-sm" />
            <span className="truncate text-sm font-semibold text-muted">{playerName}</span>
            <span
              className={`flex shrink-0 items-center gap-0.5 font-pixel text-[0.625rem] whitespace-nowrap text-ember-2 transition-opacity ${
                streak >= 2 ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={streak < 2}
            >
              <span aria-hidden="true">🔥</span>
              <span>x{streak}</span>
              <span className="sr-only"> answer streak</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <HeartsRow hearts={hearts} max={maxHearts} />
          <div className="flex items-center gap-2">
            <span
              className={`w-9 text-right font-pixel text-[0.625rem] tabular-nums ${urgent ? "text-bad" : "text-muted"}`}
              aria-hidden="true"
            >
              {secs !== null ? `${secs}s` : ""}
            </span>
            <span className="font-pixel text-xs text-gold sm:text-sm">
              <span className="sr-only">Score </span>
              <AnimatedNumber value={score} />
            </span>
          </div>
        </div>

        <Link
          href="/"
          aria-label="Leave the tower (back to home)"
          onClick={(e) => {
            if (!window.confirm("Leave the tower? This run will be lost and won't count on the leaderboard.")) e.preventDefault();
          }}
          className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded text-muted hover:text-text"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ✕
          </span>
        </Link>
      </div>
      <TimerBar remainingMs={remainingMs} limitMs={timeLimitMs} />
    </header>
  );
}
