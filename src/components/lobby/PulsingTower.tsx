"use client";

import { motion, useReducedMotion } from "motion/react";

const FLOORS = 6;

/** Small pixel tower whose windows light up floor by floor while players wait. Decorative. */
export function PulsingTower({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className={`flex flex-col items-center ${className}`.trim()}>
      {/* Beacon */}
      <motion.div
        className="mb-1 size-3 rounded-[2px] bg-ember"
        style={{ boxShadow: "0 0 18px 4px color-mix(in oklab, var(--ember) 60%, transparent)" }}
        animate={reduce ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.9, 1.15, 0.9] }}
        transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="h-2 w-6 rounded-t-[2px] bg-line" />
      <div className="flex flex-col-reverse gap-1 rounded-t-sm border-2 border-line bg-surface-2 p-1.5">
        {Array.from({ length: FLOORS }, (_, i) => (
          <div key={i} className="flex gap-1">
            {[0, 1, 2].map((w) => (
              <motion.span
                key={w}
                className="block h-2.5 w-3 rounded-[1px] bg-gold"
                initial={{ opacity: reduce ? 0.7 : 0.15 }}
                animate={reduce ? { opacity: 0.7 } : { opacity: [0.15, 1, 0.15] }}
                transition={
                  reduce
                    ? undefined
                    : { duration: 2.4, repeat: Infinity, delay: i * 0.3 + w * 0.08, ease: "easeInOut" }
                }
              />
            ))}
          </div>
        ))}
      </div>
      <div className="h-1.5 w-24 rounded-[2px] bg-ember/60" />
    </div>
  );
}
