"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HeroCard } from "@/components/character/HeroCard";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="lobby-heading" className="sr-only">
          Lobby
        </h2>
        <p aria-live="polite" className="flex items-center gap-3">
          <span aria-hidden="true" className="text-3xl xl:text-5xl">
            👥
          </span>
          <motion.span
            key={count}
            initial={reduce ? false : { scale: 1.4, color: "#ffcf4a" }}
            animate={{ scale: 1, color: "#f4eeff" }}
            transition={{ duration: 0.4 }}
            className="inline-block font-pixel text-4xl xl:text-6xl"
          >
            {count}
          </motion.span>
          <span className="sr-only">{count === 1 ? "hero ready" : "heroes ready"}</span>
          {!connected && (
            <span title="Connecting" className="text-xl motion-safe:animate-pulse">
              <span aria-hidden="true">📡</span>
              <span className="sr-only">Connecting</span>
            </span>
          )}
        </p>
      </div>

      <div className="flex-1">
        {count === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line p-6 text-center">
            <span aria-hidden="true" className="text-5xl motion-safe:animate-bounce">
              🗼
            </span>
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
                  <HeroCard name={p.name} heroId={p.heroId} />
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
            aria-label="Start the climb"
            className="w-full max-w-xl py-5 text-sm xl:text-lg"
          >
            {starting ? "⏳" : "▶ Start"}
          </Button>
        </div>
      )}
    </Panel>
  );
}
