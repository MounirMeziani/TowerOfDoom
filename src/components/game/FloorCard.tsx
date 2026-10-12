"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Floor, Mode } from "@/lib/types";

export function ModeBadge({ mode }: { mode: Mode }) {
  const giving = mode === "giving";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border-2 px-2 py-1 font-pixel text-[0.625rem] leading-none ${
        giving ? "border-giving/70 bg-giving/15 text-giving" : "border-receiving/70 bg-receiving/15 text-receiving"
      }`}
    >
      <span aria-hidden="true">{giving ? "📤" : "📥"}</span>
      {giving ? "GIVING" : "RECEIVING"}
      <span className="font-sans text-[0.6875rem] font-semibold normal-case">feedback</span>
    </span>
  );
}

/** Villain + department + scenario. Shared by regular and boss floors. */
export function FloorHeader({ floor, floorNumber, compact = false }: { floor: Floor; floorNumber: number; compact?: boolean }) {
  const reduce = useReducedMotion();
  const isBoss = floor.kind === "boss";
  const v = floor.villain;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {isBoss && (
        <motion.p
          className="rounded border-2 border-gold bg-gold/10 py-2 text-center font-pixel text-[0.625rem] text-gold sm:text-xs"
          initial={reduce ? false : { scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
        >
          <span aria-hidden="true">⚠ </span>BOSS FLOOR<span aria-hidden="true"> ⚠</span>
        </motion.p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs font-semibold tracking-wide text-muted uppercase">
          <span className="sr-only">Floor {floorNumber}: </span>
          {floor.department}
        </p>
        <ModeBadge mode={floor.mode} />
      </div>

      <div
        className={`flex items-center gap-3 rounded-lg border-2 p-3 ${
          isBoss ? "border-gold/60 bg-gold/5" : "border-line bg-surface-2"
        }`}
      >
        <motion.span
          aria-hidden="true"
          className={`shrink-0 leading-none ${isBoss ? "text-6xl sm:text-7xl" : compact ? "text-4xl" : "text-4xl sm:text-5xl"}`}
          initial={reduce ? false : isBoss ? { scale: 0.3, rotate: -20 } : { y: 8, opacity: 0 }}
          animate={
            reduce
              ? undefined
              : isBoss
                ? { scale: 1, rotate: [0, -6, 6, -3, 0] }
                : { y: 0, opacity: 1 }
          }
          transition={isBoss ? { duration: 0.8 } : { duration: 0.3 }}
        >
          {v.emoji}
        </motion.span>
        <div className="min-w-0">
          <p className={`font-pixel text-[0.6875rem] leading-snug sm:text-xs ${isBoss ? "text-gold" : "text-bad"}`}>
            {v.name}
          </p>
          <p className="text-xs text-muted">{v.title}</p>
          {!compact && <p className="mt-1 hidden text-sm text-text/90 italic sm:block">&ldquo;{v.taunt}&rdquo;</p>}
        </div>
      </div>

      {!compact && <p className="text-base leading-relaxed text-text">{floor.setup}</p>}

      {floor.kind === "spot" && floor.quote && (
        <figure className="relative ml-2 rounded-lg border-2 border-line bg-bg px-4 py-3">
          <span
            aria-hidden="true"
            className="absolute -top-2 left-5 size-3 rotate-45 border-t-2 border-l-2 border-line bg-bg"
          />
          <figcaption className="sr-only">Quoted {floor.mode === "giving" ? "feedback" : "reaction"}</figcaption>
          <blockquote
            className={`border-l-4 pl-3 text-base leading-relaxed italic ${
              floor.mode === "giving" ? "border-giving" : "border-receiving"
            }`}
          >
            {floor.quote}
          </blockquote>
        </figure>
      )}

      <h2 className="text-lg leading-snug font-bold text-text">{floor.prompt}</h2>
    </div>
  );
}
