"use client";

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
        Your answer
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
        rows={6}
        disabled={judging}
        placeholder={floor.placeholder}
        aria-describedby={counterId}
        className="min-h-36 w-full resize-y rounded-lg border-2 border-line bg-bg p-3 text-base leading-relaxed text-text placeholder:text-muted/70 focus-visible:border-ember disabled:opacity-60"
      />
      <div className="flex justify-end text-xs text-muted">
        <span id={counterId} className={`tabular-nums ${len >= BOSS_MAX_CHARS ? "text-bad" : ""}`}>
          <span className="sr-only">Characters: </span>
          {len}/{BOSS_MAX_CHARS}
        </span>
      </div>

      {judging ? (
        <div
          role="status"
          aria-label="Judging"
          className="flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-gold/60 bg-gold/10"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className="block size-3 animate-pulse rounded-[2px] bg-gold"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          Send
        </Button>
      )}
    </form>
  );
}
