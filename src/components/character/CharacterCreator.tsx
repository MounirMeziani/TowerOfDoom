"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { HEROES, getHero } from "@/lib/characters";
import { savePlayer } from "@/lib/player";
import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { HeroAvatar } from "./HeroAvatar";
import { HeroCard } from "./HeroCard";

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

/** Name + hero picker with a live preview card. Saves the player via savePlayer(). */
export function CharacterCreator({ initial, sessionCode, submitLabel, onDone }: CharacterCreatorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [heroId, setHeroId] = useState(getHero(initial?.heroId).id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diceSpins, setDiceSpins] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const nameId = useId();
  const errorId = useId();
  const hintId = useId();
  const groupLabelId = useId();
  const radioName = useId();
  const hero = getHero(heroId);
  const trimmed = name.trim();

  function handleNameChange(value: string) {
    const next = value.slice(0, MAX_NAME);
    setName(next);
    if (error && next.trim().length > 0) setError(null);
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
      setError(`Your hero needs a name (1-${MAX_NAME} characters).`);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    const player = savePlayer({ id: initial?.id, name: trimmed, heroId, sessionCode });
    onDone(player);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Name */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={nameId} className="font-pixel text-[0.625rem] text-muted uppercase">
            Hero name
          </label>
          <span
            id={hintId}
            className={`text-xs tabular-nums ${name.length >= MAX_NAME ? "text-gold" : "text-muted"}`}
          >
            {name.length}/{MAX_NAME}
          </span>
        </div>
        <input
          ref={inputRef}
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          maxLength={MAX_NAME}
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="go"
          spellCheck={false}
          placeholder="e.g. Alex the Brave"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          className={`min-h-12 w-full rounded-md border-2 bg-surface-2 px-3 py-2 text-base text-text transition-colors placeholder:text-muted/70 focus-visible:border-ember ${
            error ? "border-bad" : "border-line"
          }`}
        />
        {error && (
          <p id={errorId} role="alert" className="flex items-center gap-2 text-sm text-bad">
            <span aria-hidden="true">✗</span>
            {error}
          </p>
        )}
      </div>

      {/* Hero picker: native radios give radiogroup semantics + arrow-key navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span id={groupLabelId} className="font-pixel text-[0.625rem] text-muted uppercase">
            Choose your hero
          </span>
          <button
            type="button"
            onClick={rollRandomHero}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-line bg-surface-2 px-3 text-sm font-semibold text-text transition-colors hover:border-gold hover:text-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
          >
            <motion.span
              aria-hidden="true"
              className="inline-block text-base"
              animate={reduceMotion ? undefined : { rotate: diceSpins * 360 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
            >
              🎲
            </motion.span>
            Random hero
          </button>
        </div>

        <div role="radiogroup" aria-labelledby={groupLabelId} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HEROES.map((h) => {
            const selected = h.id === heroId;
            return (
              <label
                key={h.id}
                className={`relative flex min-h-16 min-w-0 cursor-pointer items-center gap-1.5 rounded-md border-2 p-1.5 transition-[border-color,background-color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember sm:flex-col sm:justify-start sm:gap-1.5 sm:p-2 sm:text-center ${
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
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span lang="en" className="text-xs leading-tight font-semibold hyphens-auto text-text">
                    {h.name}
                  </span>
                  <span className="line-clamp-2 text-[0.6875rem] leading-snug text-muted">{h.title}</span>
                </span>
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-sm border-2 border-bg text-[0.625rem] font-bold text-bg"
                    style={{ backgroundColor: h.color }}
                  >
                    ✓
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {`${hero.name} selected. Perk: ${hero.perk}.`}
        </p>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-2">
        <span className="font-pixel text-[0.625rem] text-muted uppercase">Preview</span>
        <motion.div
          key={hero.id}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-2"
        >
          <HeroCard name={trimmed || "Your hero"} heroId={hero.id} subtitle={hero.title} highlight avatarSize="lg" />
          <p className="flex items-start gap-2 text-sm text-muted">
            <span aria-hidden="true" style={{ color: hero.color }}>
              ★
            </span>
            <span>
              <span className="font-semibold" style={{ color: hero.color }}>
                Perk:
              </span>{" "}
              {hero.perk}
            </span>
          </p>
        </motion.div>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={busy} aria-busy={busy || undefined}>
        {busy ? "Opening the doors..." : submitLabel}
        {!busy && <span aria-hidden="true">▲</span>}
      </Button>
    </form>
  );
}
