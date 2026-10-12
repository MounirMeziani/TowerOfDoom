"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HeroCard } from "@/components/character/HeroCard";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { getHero } from "@/lib/characters";
import type { LobbyPresence } from "@/lib/types";

export interface LobbyStageProps {
  players: LobbyPresence[];
  connected: boolean;
  canStart: boolean;
  starting: boolean;
  onStart(): void;
}

/** Live grid of heroes waiting in the lobby, with the big Start button for the admin. */
export function LobbyStage({ players, connected, canStart, starting, onStart }: LobbyStageProps) {
  const reduce = useReducedMotion();
  const count = players.length;

  return (
    <Panel as="section" aria-labelledby="lobby-heading" className="flex min-h-[28rem] flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="lobby-heading" className="font-pixel text-xs uppercase text-ember-2 xl:text-sm">
            The lobby
          </h2>
          <p className="mt-2 text-sm text-muted xl:text-base">
            {connected ? "Heroes appear here as they join." : "Connecting to the lobby..."}
          </p>
        </div>
        <p aria-live="polite" className="text-right">
          <motion.span
            key={count}
            initial={reduce ? false : { scale: 1.4, color: "#ffcf4a" }}
            animate={{ scale: 1, color: "#f4eeff" }}
            transition={{ duration: 0.4 }}
            className="inline-block font-pixel text-4xl xl:text-6xl"
          >
            {count}
          </motion.span>
          <span className="ml-3 font-pixel text-xs uppercase text-muted xl:text-sm">
            {count === 1 ? "hero ready" : "heroes ready"}
          </span>
        </p>
      </div>

      <div className="flex-1">
        {count === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line p-6 text-center">
            <span aria-hidden="true" className="text-5xl motion-safe:animate-bounce">
              🗼
            </span>
            <p className="text-muted xl:text-lg">Waiting for the first brave hero to scan the code...</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {players.map((p) => (
                <motion.li
                  key={p.playerId}
                  layout={reduce ? false : "position"}
                  initial={reduce ? false : { opacity: 0, scale: 0.6, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, transition: { duration: 0.25 } }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                >
                  <HeroCard name={p.name} heroId={p.heroId} subtitle={getHero(p.heroId).title} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {canStart && (
        <div className="flex flex-col items-center gap-2 border-t-2 border-line pt-5">
          <Button
            size="lg"
            onClick={onStart}
            disabled={starting}
            className="w-full max-w-xl py-5 text-sm xl:text-lg"
          >
            {starting ? "Opening the gates..." : "Start the Climb"}
          </Button>
          <p className="text-xs text-muted">
            {count > 0
              ? "Everyone in the lobby gets a 3-2-1 countdown and starts together."
              : connected
                ? "No heroes yet. You can still start; anyone in the lobby gets the countdown."
                : "Live hero list is offline on this screen. Starting still reaches every hero in the lobby."}
          </p>
        </div>
      )}
    </Panel>
  );
}
