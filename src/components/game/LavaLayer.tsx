"use client";

import { motion, useReducedMotion } from "motion/react";

/** Decorative lava that rises from the bottom of the screen as hearts are lost. */
export function LavaLayer({ hearts, max }: { hearts: number; max: number }) {
  const reduce = useReducedMotion();
  const lost = Math.min(max, Math.max(0, max - hearts));
  const heightVh = [2.5, 9, 17, 28][Math.min(3, Math.round((lost / Math.max(1, max)) * 3))];

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 print:hidden"
      initial={false}
      animate={{ height: `${heightVh}vh` }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 16 }}
      style={{
        background:
          "linear-gradient(to top, color-mix(in oklab, var(--ember) 70%, #7a1606) 0%, color-mix(in oklab, var(--ember) 45%, transparent) 55%, transparent 100%)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-2 opacity-80"
        style={{
          background:
            "repeating-linear-gradient(90deg, var(--ember-2) 0 12px, transparent 12px 20px, var(--gold) 20px 26px, transparent 26px 40px)",
          filter: "blur(1px)",
        }}
      />
    </motion.div>
  );
}
