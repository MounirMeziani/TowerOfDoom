"use client";

import Link from "next/link";
import { useState } from "react";
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
  /** null hides the countdown (exploring / reveal / judging). */
  remainingMs: number | null;
  /** Shows the 2D/3D switch in the menu. */
  view?: { is3D: boolean; onToggle: () => void } | null;
  /** "overlay" floats over the 3D scene; "bar" is the sticky 2D header. */
  variant?: "bar" | "overlay";
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
    <div className={`relative h-2 w-full bg-surface-2 ${active ? "" : "opacity-0"}`} aria-hidden={!active}>
      <div
        className={`h-full origin-left transition-[transform,background-color] duration-300 ease-linear ${
          urgent ? "animate-pulse bg-bad" : "bg-ember"
        }`}
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

function HudMenu({ view }: { view: HudProps["view"] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative -mr-2 shrink-0">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-11 items-center justify-center rounded text-lg leading-none text-muted hover:text-text"
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Menu"
          className="absolute top-full right-0 z-40 mt-1 flex flex-col gap-1 rounded-lg border-2 border-line bg-surface p-1 shadow-xl"
        >
          {view && (
            <button
              type="button"
              role="menuitem"
              aria-label={view.is3D ? "Switch to 2D" : "Switch to 3D"}
              onClick={() => {
                setOpen(false);
                view.onToggle();
              }}
              className="flex min-h-11 min-w-20 items-center justify-center rounded px-3 font-pixel text-xs text-text hover:bg-surface-2"
            >
              {view.is3D ? "2D" : "3D"}
            </button>
          )}
          <Link
            href="/"
            role="menuitem"
            aria-label="Leave the tower"
            onClick={(e) => {
              if (!window.confirm("Leave?")) e.preventDefault();
            }}
            className="flex min-h-11 min-w-20 items-center justify-center rounded px-3 text-lg text-muted hover:bg-surface-2 hover:text-text"
          >
            <span aria-hidden="true">✕</span>
          </Link>
        </div>
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
  view = null,
  variant = "bar",
}: HudProps) {
  const floor = floors[index];
  const isBoss = floor?.kind === "boss";
  const secs = remainingMs !== null ? Math.ceil(Math.max(0, remainingMs) / 1000) : null;
  const urgent = remainingMs !== null && remainingMs < 10_000;
  const shell =
    variant === "overlay"
      ? "pointer-events-auto relative"
      : "sticky top-0 z-30 border-b-2 border-line bg-bg/90 backdrop-blur";
  // Overlay: two floating pills (the top centre stays clear so the scene shows through).
  const overlay = variant === "overlay";
  const pill = "rounded-lg bg-bg/70 px-2 py-1 backdrop-blur-sm";

  return (
    <header className={`${shell} print:hidden`}>
      <div
        className={`mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] ${
          overlay ? "justify-between" : ""
        }`}
      >
        <div className={overlay ? `flex min-w-0 flex-none items-center gap-3 ${pill}` : "contents"}>
          <TowerProgress floors={floors} index={index} cleared={cleared} />

          <div className={`flex min-w-0 items-center gap-2 ${overlay ? "flex-none" : "flex-1"}`}>
            <HeroAvatar heroId={heroId} size="sm" className="!size-7 !text-base" />
            <span className="sr-only">{playerName}</span>
            <span
              className={`font-pixel text-xs whitespace-nowrap sm:text-sm ${isBoss ? "text-gold" : "text-text"}`}
              aria-label={`${isBoss ? "Boss floor" : "Floor"} ${Math.min(index + 1, floors.length)} of ${floors.length}`}
            >
              {isBoss && <span aria-hidden="true">⚔ </span>}
              {Math.min(index + 1, floors.length)}/{floors.length}
            </span>
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

        <div className={overlay ? `flex shrink-0 items-center gap-3 ${pill}` : "contents"}>
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

          <HudMenu view={view} />
        </div>
      </div>
      <TimerBar remainingMs={remainingMs} limitMs={timeLimitMs} />
    </header>
  );
}
