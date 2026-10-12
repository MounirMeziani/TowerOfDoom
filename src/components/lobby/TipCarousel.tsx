"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { A_INFO, type AKey } from "@/lib/types";
import { ABadge } from "@/components/ui/ABadge";

const ORDER: AKey[] = ["assist", "actionable", "appreciate", "acceptOrDecline"];
const INTERVAL_MS = 6000;

/** Rotating tip card cycling through the 4 A's every 6s (pauses on hover / focus). */
export function TipCarousel({ className = "" }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % ORDER.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused]);

  const key = ORDER[index];
  const info = A_INFO[key];
  const giving = info.mode === "giving";

  return (
    <section
      aria-label="Tip about the 2 A's of Feedback"
      className={`rounded-lg border-2 bg-surface p-4 ${giving ? "border-giving/40" : "border-receiving/40"} ${className}`.trim()}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-pixel text-[0.625rem] text-muted uppercase">
          {giving ? "When giving" : "When receiving"} · Tip {index + 1}/{ORDER.length}
        </p>
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % ORDER.length)}
          className="-my-2 -mr-2 flex min-h-11 min-w-11 items-center justify-center rounded text-sm text-muted hover:text-text"
          aria-label="Next tip"
        >
          <span aria-hidden="true">▶</span>
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={{ duration: reduce ? 0 : 0.25 }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <ABadge a={key} />
            <span className={`text-sm font-semibold ${giving ? "text-giving" : "text-receiving"}`}>{info.short}</span>
          </div>
          <p className="text-sm leading-relaxed text-text/90">{info.description}</p>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
