"use client";

import { motion, useReducedMotion } from "motion/react";
import { Panel } from "@/components/ui/Panel";
import { A_KEYS, aggregateAStats, summarizeRuns, weakestA } from "@/lib/leaderboard";
import { A_INFO, type RunRow } from "@/lib/types";

/** Live session numbers + team mastery per A, with the team's weakest A called out. */
export function SessionStats({ runs, online }: { runs: RunRow[]; online: number }) {
  const reduce = useReducedMotion();
  const summary = summarizeRuns(runs);
  const stats = aggregateAStats(runs);
  const weakest = weakestA(stats);

  const tiles = [
    { label: "Heroes online", value: String(online) },
    { label: "Runs finished", value: String(summary.runs) },
    { label: "Victory rate", value: summary.runs ? `${Math.round(summary.victoryRate * 100)}%` : "-" },
    { label: "Avg score", value: summary.runs ? summary.avgScore.toLocaleString("en-US") : "-" },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Panel as="section" aria-label="Session stats">
        <dl className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border-2 border-line bg-surface-2 px-3 py-3">
              <dt className="text-xs uppercase tracking-wider text-muted">{t.label}</dt>
              <dd className="mt-1 font-pixel text-xl text-text xl:text-2xl">{t.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel as="section" aria-labelledby="mastery-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="mastery-heading" className="font-pixel text-xs uppercase text-ember-2 xl:text-sm">
            Team mastery
          </h2>
          {weakest ? (
            <p className="rounded border-2 border-gold/60 bg-gold/10 px-2 py-1 text-sm font-semibold text-gold">
              Workshop focus: {A_INFO[weakest].label}
            </p>
          ) : (
            <p className="text-sm text-muted">Mastery appears as runs finish.</p>
          )}
        </div>
        <ul className="flex flex-col gap-3">
          {A_KEYS.map((a) => {
            const { correct, total } = stats[a];
            const pct = total ? Math.round((correct / total) * 100) : 0;
            const info = A_INFO[a];
            const giving = info.mode === "giving";
            const isWeakest = a === weakest;
            return (
              <li key={a} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={`font-semibold ${giving ? "text-giving" : "text-receiving"}`}>
                    {info.label}
                    <span className="ml-2 text-xs font-normal text-muted">
                      {giving ? "Giving" : "Receiving"} · {info.short}
                    </span>
                    {isWeakest && <span className="ml-2 text-xs text-gold">← weakest</span>}
                  </span>
                  <span className="font-pixel text-xs text-text">
                    {total ? `${pct}%` : "-"}
                    <span className="ml-2 text-[0.5625rem] text-muted">
                      {correct}/{total}
                    </span>
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${info.label} team accuracy`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className={`h-4 overflow-hidden rounded-sm border-2 bg-bg ${isWeakest ? "border-gold" : "border-line"}`}
                >
                  <motion.div
                    className={`h-full ${giving ? "bg-giving" : "bg-receiving"}`}
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 22 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
