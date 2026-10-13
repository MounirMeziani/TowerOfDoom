"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const STEPS = ["3", "2", "1", "CLIMB!"] as const;
const STEP_MS = 850;

/**
 * Full-screen 3-2-1-CLIMB! overlay. Calls onDone once after the last step.
 * backdrop=false keeps the scene behind visible (3D lobby: the elevator doors open behind the numbers).
 */
export function ClimbCountdown({ onDone, backdrop = true }: { onDone: () => void; backdrop?: boolean }) {
  const [step, setStep] = useState(0);
  const reduce = useReducedMotion();
  const onDoneRef = useRef(onDone);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog so Enter/Space cannot reach the (inert) lobby controls underneath.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i < STEPS.length) {
        setStep(i);
      } else {
        clearInterval(id);
        onDoneRef.current();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, []);

  const label = STEPS[step];
  const final = step === STEPS.length - 1;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="alertdialog"
      aria-modal="true"
      aria-label="The climb is starting"
      className={`fixed inset-0 z-50 flex outline-none flex-col items-center justify-center gap-6 px-4 text-center ${
        backdrop ? "bg-bg/95 backdrop-blur" : "bg-bg/25"
      }`}
    >
      <div aria-live="assertive" className="flex h-40 items-center justify-center">
        {reduce ? (
          <p className={`font-pixel text-5xl ${final ? "text-ember" : "text-gold"}`}>{label}</p>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.p
              key={label}
              initial={{ opacity: 0, scale: 2.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className={`font-pixel ${final ? "text-4xl text-ember sm:text-6xl" : "text-7xl text-gold sm:text-8xl"}`}
              style={{ textShadow: `0 0 32px ${final ? "var(--ember)" : "var(--gold)"}` }}
            >
              {label}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
