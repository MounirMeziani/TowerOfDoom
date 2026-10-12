"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { BossFloor } from "@/lib/types";

export const BOSS_MAX_CHARS = 600;

interface BossInputProps {
  floor: BossFloor;
  text: string;
  judging: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
}

/** Free-text answer for a boss floor. State lives in the parent so the timer can auto-submit it. */
export function BossInput({ floor, text, judging, onChange, onSubmit }: BossInputProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const counterId = useId();
  const len = text.length;
  const canSubmit = text.trim().length > 0 && !judging;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (canSubmit) onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-busy={judging}>
      <label htmlFor={id} className="sr-only">
        Your answer to {floor.villain.name}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => onChange(e.target.value.slice(0, BOSS_MAX_CHARS))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        maxLength={BOSS_MAX_CHARS}
        rows={7}
        disabled={judging}
        placeholder={floor.placeholder}
        aria-describedby={counterId}
        className="min-h-40 w-full resize-y rounded-lg border-2 border-line bg-bg p-3 text-base leading-relaxed text-text placeholder:text-muted/70 focus-visible:border-ember disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>Tip: cover both A&apos;s in 2-4 sentences.</span>
        <span id={counterId} className={`tabular-nums ${len >= BOSS_MAX_CHARS ? "text-bad" : ""}`}>
          {len}/{BOSS_MAX_CHARS}
        </span>
      </div>

      {judging ? (
        <div
          role="status"
          className="flex min-h-14 items-center justify-center gap-3 rounded-lg border-2 border-gold/60 bg-gold/10 px-4 text-center text-sm font-semibold text-gold"
        >
          <motion.span
            aria-hidden="true"
            className="text-2xl"
            animate={reduce ? undefined : { rotate: [0, -10, 10, 0], scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            {floor.villain.emoji}
          </motion.span>
          The boss is reading your words...
        </div>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          Strike with your words
        </Button>
      )}
    </form>
  );
}
