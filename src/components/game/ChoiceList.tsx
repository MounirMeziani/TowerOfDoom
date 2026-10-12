"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RegularFloor } from "@/lib/types";

/** Answer buttons for a regular floor. Number keys 1-4 are handled by the parent (Game). */
export function ChoiceList({ floor, onAnswer }: { floor: RegularFloor; onAnswer: (choiceId: string) => void }) {
  const reduce = useReducedMotion();
  return (
    <ol className="flex flex-col gap-3" aria-label="Choices (press 1 to 4)">
      {floor.choices.map((c, i) => (
        <motion.li
          key={c.id}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.05 * i, duration: 0.2 }}
        >
          <button
            type="button"
            onClick={() => onAnswer(c.id)}
            className="group flex min-h-14 w-full items-start gap-3 rounded-lg border-2 border-line bg-surface-2 p-3 text-left text-base leading-snug text-text shadow-[0_3px_0_0_#0b0614] transition-[border-color,background-color,transform] duration-150 hover:border-ember hover:bg-ember/10 focus-visible:border-ember active:translate-y-px"
          >
            <kbd
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded border-2 border-line bg-bg font-pixel text-[0.625rem] text-ember-2 group-hover:border-ember"
            >
              {i + 1}
            </kbd>
            <span className="min-w-0 pt-0.5">{c.text}</span>
          </button>
        </motion.li>
      ))}
    </ol>
  );
}
