"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HEROES, getHero } from "@/lib/characters";
import { savePlayer } from "@/lib/player";
import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { HeroAvatar } from "./HeroAvatar";

export interface CharacterCreatorProps {
  initial?: Partial<Player>;
  sessionCode: string | null;
  submitLabel: string;
  onDone(player: Player): void;
}

const MAX_NAME = 24;

const tileVariants = {
  idle: { y: 0, scale: 1 },
  picked: { y: [0, -9, 0, -3, 0], scale: [1, 1.12, 1, 1.04, 1], transition: { duration: 0.55 } },
};

/** "Ledger Knight" -> "Knight": one word fits a phone tile. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** Name + hero picker with a live mini preview. Saves the player via savePlayer(). */
export function CharacterCreator({ initial, sessionCode, submitLabel, onDone }: CharacterCreatorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [heroId, setHeroId] = useState(getHero(initial?.heroId).id);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diceSpins, setDiceSpins] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const errorId = useId();
  const radioName = useId();
  const hero = getHero(heroId);
  const trimmed = name.trim();

  function handleNameChange(value: string) {
    const next = value.slice(0, MAX_NAME);
    setName(next);
    if (error && next.trim().length > 0) setError(false);
  }

  function rollRandomHero() {
    const others = HEROES.filter((h) => h.id !== heroId);
    const pick = others[Math.floor(Math.random() * others.length)];
    if (pick) setHeroId(pick.id);
    setDiceSpins((n) => n + 1);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (trimmed.length < 1 || trimmed.length > MAX_NAME) {
      setError(true);
      inputRef.current?.focus();
      return;
    }
    setError(false);
    setBusy(true);
    const player = savePlayer({ id: initial?.id, name: trimmed, heroId, sessionCode });
    onDone(player);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Name + dice */}
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={MAX_NAME}
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="go"
            spellCheck={false}
            placeholder="Name"
            aria-label={`Hero name, 1 to ${MAX_NAME} characters`}
            aria-invalid={error || undefined}
            aria-describedby={error ? errorId : undefined}
            className={`min-h-12 w-full rounded-md border-2 bg-surface-2 px-3 py-2 text-base text-text transition-colors placeholder:text-muted/70 focus-visible:border-ember ${
              error ? "border-bad" : "border-line"
            }`}
          />
          {error && (
            <p id={errorId} role="alert" className="text-xs text-bad tabular-nums">
              <span className="sr-only">Name needs </span>1-{MAX_NAME}
              <span className="sr-only"> characters</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={rollRandomHero}
          aria-label="Random hero"
          title="Random hero"
          className="grid size-12 shrink-0 place-items-center rounded-md border-2 border-line bg-surface-2 text-xl transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <motion.span
            aria-hidden="true"
            className="inline-block"
            animate={reduceMotion ? undefined : { rotate: diceSpins * 360 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            🎲
          </motion.span>
        </button>
      </div>

      {/* Hero picker: native radios give radiogroup semantics + arrow-key navigation */}
      <div role="radiogroup" aria-label="Hero" className="grid grid-cols-4 gap-2">
        {HEROES.map((h) => {
          const selected = h.id === heroId;
          return (
            <label
              key={h.id}
              title={h.name}
              className={`relative flex min-h-20 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 p-1.5 text-center transition-[border-color,background-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
                selected ? "" : "border-line bg-surface hover:border-muted hover:bg-surface-2"
              }`}
              style={
                selected
                  ? {
                      borderColor: h.color,
                      backgroundColor: `color-mix(in oklab, ${h.color} 14%, #1f1233)`,
                      boxShadow: `0 0 22px -6px ${h.color}, inset 0 0 0 1px color-mix(in oklab, ${h.color} 40%, transparent)`,
                    }
                  : undefined
              }
            >
              <input
                type="radio"
                name={radioName}
                value={h.id}
                checked={selected}
                onChange={() => setHeroId(h.id)}
                aria-label={h.name}
                className="sr-only"
              />
              <motion.span
                className="inline-flex shrink-0"
                variants={tileVariants}
                initial={false}
                animate={selected && !reduceMotion ? "picked" : "idle"}
              >
                <HeroAvatar heroId={h.id} size="md" bob={selected} />
              </motion.span>
              <span aria-hidden="true" className="w-full truncate text-[0.6875rem] leading-tight font-semibold text-text">
                {shortName(h.name)}
              </span>
            </label>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {`${hero.name} selected.`}
      </p>

      {/* Mini preview + submit */}
      <div className="flex items-center gap-3">
        <motion.div
          key={hero.id}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <HeroAvatar heroId={hero.id} size="md" />
          <span className="truncate font-semibold" style={{ color: hero.color }}>
            {trimmed || "?"}
          </span>
        </motion.div>
        <Button
          type="submit"
          size="lg"
          className="min-w-32 shrink-0"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy ? (
            <span role="img" aria-label="Loading" className="inline-block size-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
          ) : (
            <>
              {submitLabel}
              <span aria-hidden="true">▲</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
