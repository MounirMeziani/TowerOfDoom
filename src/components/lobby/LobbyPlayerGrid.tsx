"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getHero } from "@/lib/characters";
import type { LobbyPresence } from "@/lib/types";
import { HeroAvatar } from "@/components/character/HeroAvatar";

export interface LobbyPlayerGridProps {
  players: LobbyPresence[];
  meId?: string | null;
  className?: string;
}

/** Live grid of heroes in the lobby: pop-in on join, fade-out on leave. */
export function LobbyPlayerGrid({ players, meId, className = "" }: LobbyPlayerGridProps) {
  const reduce = useReducedMotion();
  return (
    <ul className={`grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4 ${className}`.trim()}>
      <AnimatePresence initial={false}>
        {players.map((p) => {
          const hero = getHero(p.heroId);
          const isMe = p.playerId === meId;
          return (
            <motion.li
              key={p.playerId}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 26 }}
              className="flex min-w-0 items-center gap-2 rounded-md border-2 bg-surface p-2"
              style={{ borderColor: isMe ? hero.color : "var(--line)" }}
            >
              <HeroAvatar heroId={hero.id} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{p.name}</p>
                <p className="truncate text-[0.6875rem]" style={{ color: hero.color }}>
                  {isMe ? "You" : p.phase === "lobby" ? hero.name : p.phase === "playing" ? "Climbing…" : "Finished"}
                </p>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
