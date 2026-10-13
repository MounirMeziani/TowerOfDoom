"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { TowerArt } from "@/components/brand/TowerArt";
import { HeroAvatar } from "@/components/character/HeroAvatar";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { durationMs, floorsCleared, type GameState } from "@/lib/game/engine";
import { mastery, weakestA } from "@/lib/game/scoring";
import { ApiError } from "@/lib/api";
import { buildRunSubmission, runKeyFor, submitOnce } from "@/lib/game/submit";
import { A_INFO, type AKey, type Player, type RunSubmission, type SessionStatus } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

const A_ORDER: readonly AKey[] = ["assist", "actionable", "appreciate", "acceptOrDecline"];

/** Automatic retries when the save endpoint is rate limited (429), before showing "Retry save". */
const MAX_AUTO_RETRIES = 5;

type SubmitState =
  | { status: "saving" }
  | { status: "waiting" }
  | { status: "saved"; rank: number | null }
  | { status: "error"; message: string };

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface FinishedScreenProps {
  state: GameState;
  player: Player;
  sessionCode: string | null;
  /** Live session status; "lobby" after a finished run means the host opened a new round. */
  sessionStatus: SessionStatus | null;
  onPlayAgain: () => void;
}

export function FinishedScreen({ state, player, sessionCode, sessionStatus, onPlayAgain }: FinishedScreenProps) {
  const reduce = useReducedMotion();
  const victory = state.outcome === "victory";
  const cleared = floorsCleared(state);
  const time = durationMs(state);
  const weakest = weakestA(state.aStats);
  const weakestRatio = weakest ? mastery(state.aStats, weakest) : null;
  const runKey = runKeyFor(player, state);
  const nextRoundInLobby = !!sessionCode && sessionStatus === "lobby";
  const lobbyHref = sessionCode ? `/lobby/${encodeURIComponent(sessionCode)}` : "/";

  // Game already fired this save when the run finished; submitOnce hands back that same promise.
  const run = useMemo<RunSubmission>(() => buildRunSubmission(state, player, sessionCode), [state, player, sessionCode]);

  const [submit, setSubmit] = useState<SubmitState>({ status: "saving" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    submitOnce(runKey, run).then(
      (r) => {
        if (!cancelled) setSubmit({ status: "saved", rank: r.rank });
      },
      (err: unknown) => {
        if (cancelled) return;
        // Rate limited (a whole room saving at once): wait as asked, with jitter, and retry automatically.
        if (err instanceof ApiError && err.status === 429 && attempt < MAX_AUTO_RETRIES) {
          setSubmit({ status: "waiting" });
          const delay = Math.min(err.retryAfterSec ?? 5, 10) * 1000 + Math.random() * 3000;
          timer = window.setTimeout(() => setAttempt((a) => a + 1), delay);
          return;
        }
        setSubmit({ status: "error", message: err instanceof Error ? err.message : "Could not save your run." });
      },
    );
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [runKey, run, attempt]);

  const leaderboardHref = sessionCode ? `/leaderboard?s=${encodeURIComponent(sessionCode)}` : "/leaderboard";

  return (
    <Panel className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-17 shrink-0 sm:w-24">
          <TowerArt floorsLit={cleared} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <motion.h1
            className={`font-pixel text-xl leading-tight sm:text-3xl ${victory ? "text-gold" : "text-bad"}`}
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            {victory ? "VICTORY!" : "DOOMED!"}
          </motion.h1>
          <div className="flex items-center gap-2">
            <HeroAvatar heroId={player.heroId} size="sm" />
            <span className="truncate text-sm font-semibold text-muted">{player.name}</span>
          </div>
        </div>
      </div>

      {nextRoundInLobby && (
        <div className="flex justify-center rounded-lg border-2 border-ember-2 bg-ember/10 p-3">
          <Button href={lobbyHref} className="w-full text-center sm:w-auto" aria-label="Join the round 2 lobby">
            <span aria-hidden="true">▶</span> Round 2
          </Button>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-lg border-2 border-gold/60 bg-gold/5 p-3 text-center">
          <dt className="sr-only">Final score</dt>
          <dd className="mt-1 font-pixel text-2xl text-gold sm:text-3xl">
            <AnimatedNumber value={state.score} />
          </dd>
          {state.victoryBonus > 0 && (
            <dd className="mt-1 font-pixel text-[0.625rem] text-muted">
              <span className="sr-only">Includes a heart bonus of </span>
              <span aria-hidden="true">❤ </span>+{state.victoryBonus}
            </dd>
          )}
        </div>
        {[
          { icon: "🏢", label: "Floors cleared", value: `${cleared}/${state.floors.length}` },
          { icon: "🔥", label: "Best streak", value: `${state.bestStreak}` },
          { icon: "❤", label: "Hearts left", value: `${state.hearts}` },
          { icon: "⏱", label: "Time", value: formatDuration(time) },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-lg border-2 border-line bg-bg/60 p-3">
            <dt>
              <span aria-hidden="true" className="text-lg">
                {s.icon}
              </span>
              <span className="sr-only">{s.label}</span>
            </dt>
            <dd className="font-pixel text-sm text-text">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div role="status" aria-live="polite" className="min-h-12 rounded-lg border-2 border-line bg-surface-2 p-3 text-center">
        {(submit.status === "saving" || submit.status === "waiting") && (
          <span aria-label="Saving" className="flex justify-center gap-1.5 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="block size-2.5 animate-pulse rounded-[2px] bg-ember"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        )}
        {submit.status === "saved" && (
          <p className="font-pixel text-xs leading-relaxed text-ember-2 sm:text-sm">
            <span aria-hidden="true">🏆 </span>
            {submit.rank === null ? "✓" : `#${submit.rank}`}
            <span className="sr-only">
              {submit.rank === null ? " Run saved" : sessionCode ? ` in session ${sessionCode}` : " on the global board"}
            </span>
          </p>
        )}
        {submit.status === "error" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg text-bad" title={submit.message}>
              <span aria-hidden="true">⚠</span>
              <span className="sr-only">{submit.message}</span>
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setSubmit({ status: "saving" });
                setAttempt((a) => a + 1);
              }}
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      <section aria-labelledby="mastery-heading" className="flex flex-col gap-3">
        <h2 id="mastery-heading" className="sr-only">
          Your mastery of the 2 A&apos;s
        </h2>
        <ul className="flex flex-col gap-3">
          {A_ORDER.map((a) => {
            const s = state.aStats[a];
            const r = mastery(state.aStats, a);
            const pct = r === null ? 0 : Math.round(r * 100);
            const giving = A_INFO[a].mode === "giving";
            return (
              <li key={a} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={`font-semibold ${giving ? "text-giving" : "text-receiving"}`}>
                    {A_INFO[a].label}
                    {a === weakest && weakestRatio !== null && weakestRatio < 1 && (
                      <span className="ml-2 rounded-sm bg-bad/20 px-1.5 py-0.5 text-xs font-semibold text-bad">
                        <span aria-hidden="true">⚠</span>
                        <span className="sr-only">weakest</span>
                      </span>
                    )}
                  </span>
                  <span className="text-muted tabular-nums">{r === null ? "–" : `${s.correct}/${s.total}`}</span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-sm border border-line bg-bg"
                  role="meter"
                  aria-label={`${A_INFO[a].label} mastery`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <motion.div
                    className={`h-full ${giving ? "bg-giving" : "bg-receiving"}`}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={reduce ? { width: `${pct}%` } : undefined}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {weakest && weakestRatio !== null && weakestRatio < 1 && (
          <Link
            href={`/learn#${weakest}`}
            className="self-start font-semibold text-ember-2 underline underline-offset-4 hover:text-ember"
            aria-label={`Study ${A_INFO[weakest].label}`}
          >
            <span aria-hidden="true">📖 </span>
            {A_INFO[weakest].label}
          </Link>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        {nextRoundInLobby ? (
          <Button size="lg" href={lobbyHref} className="w-full text-center sm:flex-1" aria-label="Join the round 2 lobby">
            <span aria-hidden="true">▶</span> Round 2
          </Button>
        ) : (
          <Button size="lg" onClick={onPlayAgain} className="w-full text-center sm:flex-1">
            <span aria-hidden="true">↻</span> Again
          </Button>
        )}
        <Button size="lg" variant="secondary" href={leaderboardHref} className="w-full text-center sm:flex-1" aria-label="Leaderboard">
          <span aria-hidden="true">🏆</span>
        </Button>
        <Button
          size="lg"
          variant="ghost"
          href="/learn"
          className="w-full text-center whitespace-nowrap sm:w-auto sm:flex-none sm:px-4"
          aria-label="Learn the 2 A's"
        >
          <span aria-hidden="true">📖</span>
        </Button>
      </div>
    </Panel>
  );
}
