"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HeroAvatar } from "@/components/character/HeroAvatar";
import { bestRunPerPlayer, useLiveRuns, type LiveRuns, type LiveStatus } from "@/lib/leaderboard";
import type { RunRow } from "@/lib/types";

export type LeaderboardVariant = "compact" | "projector";

export interface LiveLeaderboardProps {
  sessionCode: string | null;
  limit?: number;
  variant?: LeaderboardVariant;
  /** Heading shown above the list. */
  title?: string;
  /** Text shown when there are no runs yet (defaults to the "first brave soul" line). */
  emptyMessage?: string;
  /**
   * Pre-fetched live data (e.g. from a page that also renders stats from the same runs).
   * When omitted, the component subscribes on its own.
   */
  live?: LiveRuns;
  className?: string;
}

/** Realtime leaderboard: best run per player, medals for the top 3, new entries flash briefly. */
export function LiveLeaderboard({ live, ...props }: LiveLeaderboardProps) {
  if (live) return <LeaderboardView live={live} {...props} />;
  return <SelfSubscribingLeaderboard {...props} />;
}

function SelfSubscribingLeaderboard(props: Omit<LiveLeaderboardProps, "live">) {
  const live = useLiveRuns(props.sessionCode);
  return <LeaderboardView live={live} {...props} />;
}

const MEDALS = [
  { emoji: "🥇", label: "Gold", ring: "border-gold", bg: "bg-gold/10", text: "text-gold" },
  { emoji: "🥈", label: "Silver", ring: "border-[#c9c3dc]", bg: "bg-[#c9c3dc]/10", text: "text-[#e2ddf0]" },
  { emoji: "🥉", label: "Bronze", ring: "border-[#d08a4e]", bg: "bg-[#d08a4e]/10", text: "text-[#e9a56c]" },
] as const;

function StatusDot({ status }: { status: LiveStatus }) {
  const map: Record<LiveStatus, { label: string; dot: string; text: string }> = {
    live: { label: "Live", dot: "bg-good animate-pulse", text: "text-good" },
    connecting: { label: "Connecting", dot: "bg-gold", text: "text-gold" },
    offline: { label: "Offline", dot: "bg-bad", text: "text-bad" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wider ${s.text}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function LeaderboardView({
  live,
  sessionCode,
  limit = 10,
  variant = "compact",
  title,
  emptyMessage,
  className = "",
}: Omit<LiveLeaderboardProps, "live"> & { live: LiveRuns }) {
  const reduce = useReducedMotion();
  const projector = variant === "projector";
  const rows = bestRunPerPlayer(live.runs).slice(0, limit);
  const fresh = new Set(live.freshIds);
  const latestFresh = live.runs.find((r) => r.id === live.freshIds[live.freshIds.length - 1]);
  const heading = title ?? (sessionCode ? "Session leaderboard" : "Hall of Heroes");

  return (
    <section aria-label={heading} className={`flex min-w-0 flex-col gap-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={`font-pixel uppercase text-ember-2 ${projector ? "text-sm xl:text-base" : "text-[0.625rem] sm:text-xs"}`}>
          {heading}
        </h2>
        <StatusDot status={live.status} />
      </div>

      <p className="sr-only" aria-live="polite">
        {latestFresh ? `${latestFresh.player_name} just finished with ${latestFresh.score} points.` : ""}
      </p>

      {live.error && (
        <p role="status" className="rounded-md border-2 border-bad/50 bg-bad/10 px-3 py-2 text-sm text-bad">
          {live.error}
        </p>
      )}

      {live.loading && rows.length === 0 ? (
        <ul aria-hidden="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className={`animate-pulse rounded-lg border-2 border-line bg-surface ${projector ? "h-16" : "h-14"}`} />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {emptyMessage ?? "No climbers yet. The tower awaits its first brave soul."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rows.map((run, i) => (
              <LeaderboardRow
                key={run.id}
                run={run}
                rank={i + 1}
                fresh={fresh.has(run.id)}
                projector={projector}
                reduce={Boolean(reduce)}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  );
}

function LeaderboardRow({
  run,
  rank,
  fresh,
  projector,
  reduce,
}: {
  run: RunRow;
  rank: number;
  fresh: boolean;
  projector: boolean;
  reduce: boolean;
}) {
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  const victory = run.outcome === "victory";
  const tone = fresh
    ? "border-gold bg-gold/15 shadow-[0_0_24px_-6px_var(--gold)]"
    : medal
      ? `${medal.ring} ${medal.bg}`
      : "border-line bg-surface";

  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={`flex min-w-0 items-center ${projector ? "gap-3" : "gap-2 sm:gap-3"} rounded-lg border-2 transition-colors duration-700 ${tone} ${
        projector ? "px-4 py-3" : "px-3 py-2"
      }`}
    >
      <span
        className={`flex shrink-0 justify-center font-pixel ${projector ? "w-12 text-base" : "w-6 text-[0.625rem] sm:w-8"} ${
          medal ? medal.text : "text-muted"
        }`}
      >
        {medal ? (
          <span role="img" aria-label={`${medal.label}, rank ${rank}`} className={projector ? "text-3xl" : "text-xl"}>
            {medal.emoji}
          </span>
        ) : (
          <span>
            <span className="sr-only">Rank </span>
            {rank}
          </span>
        )}
      </span>

      <HeroAvatar heroId={run.avatar ?? ""} size={projector ? "md" : "sm"} />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={`min-w-0 font-semibold text-text ${
              projector ? "truncate text-lg xl:text-xl" : "line-clamp-2 text-sm [overflow-wrap:anywhere] sm:text-base"
            }`}
          >
            {run.player_name}
          </p>
          {fresh && (
            <span className="shrink-0 rounded bg-gold px-1.5 py-0.5 font-pixel text-[0.625rem] text-bg">NEW</span>
          )}
        </div>
        <p className={projector ? "font-pixel text-[0.625rem] text-muted" : "font-sans text-xs tabular-nums text-muted"}>
          F {run.floors_cleared}/{run.total_floors}
          {victory ? ` · ${"♥".repeat(Math.min(run.hearts_left, 3))}` : ""}
          {!projector && (
            <span role="img" aria-label={victory ? "Victory" : "Doomed"} className="sm:hidden">
              {" · "}
              {victory ? "👑" : "💀"}
            </span>
          )}
        </p>
      </div>

      <span
        role="img"
        aria-label={victory ? "Victory" : "Doomed"}
        title={victory ? "Victory" : "Doomed"}
        className={`shrink-0 ${projector ? "text-2xl" : "hidden text-lg sm:inline"}`}
      >
        {victory ? "👑" : "💀"}
      </span>

      <span
        className={`shrink-0 text-right font-pixel tabular-nums ${victory ? "text-gold" : "text-text"} ${
          projector ? "min-w-[5.5rem] text-base xl:text-lg" : "min-w-[3.5rem] text-[0.625rem] sm:text-xs"
        }`}
      >
        {run.score.toLocaleString("en-US")}
        <span className="sr-only"> points</span>
      </span>
    </motion.li>
  );
}
