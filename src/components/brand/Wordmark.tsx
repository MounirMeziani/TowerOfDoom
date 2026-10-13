import type { ElementType, ReactNode } from "react";

export interface WordmarkProps {
  /** Element for the wordmark (use "h1" on pages where it is the main heading). */
  as?: ElementType;
  size?: "sm" | "md" | "lg";
  align?: "center" | "start";
  className?: string;
}

const SIZES = {
  sm: { top: "text-[0.625rem] tracking-[0.45em]", main: "text-xs" },
  md: { top: "text-[0.625rem] tracking-[0.5em]", main: "text-base sm:text-xl" },
  lg: { top: "text-[0.625rem] tracking-[0.55em] sm:text-xs", main: "text-xl sm:text-3xl lg:text-4xl" },
} as const;

/** "OLSEN / TOWER OF DOOM" pixel wordmark with an ember gradient. */
export function Wordmark({ as, size = "lg", align = "center", className = "" }: WordmarkProps) {
  const Tag = (as ?? "div") as ElementType<{ className?: string; children?: ReactNode }>;
  const s = SIZES[size];
  return (
    <Tag
      className={`flex flex-col gap-2 font-pixel leading-none ${align === "center" ? "items-center text-center" : "items-start text-left"} ${className}`.trim()}
    >
      <span className={`${s.top} text-muted`}>OLSEN</span>
      <span
        className={`${s.main} bg-linear-to-b from-gold via-ember-2 to-ember bg-clip-text leading-tight text-transparent drop-shadow-[0_3px_0_#5a1a05] print:bg-none print:text-black print:drop-shadow-none`}
      >
        TOWER OF DOOM
      </span>
    </Tag>
  );
}
