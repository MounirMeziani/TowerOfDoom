"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";

/** Counts up/down to `value`. Renders the final value immediately when reduced motion is preferred. */
export function AnimatedNumber({ value, className = "" }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en-US"));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.7, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value, reduce]);

  return <motion.span className={`tabular-nums ${className}`.trim()}>{text}</motion.span>;
}
