import { A_INFO, type AKey } from "@/lib/types";

export interface ABadgeProps {
  a: AKey;
  state?: "hit" | "miss" | "neutral";
  className?: string;
}

/** Pill for one of the 2 A's, colored by mode (giving = cyan, receiving = violet). */
export function ABadge({ a, state = "neutral", className = "" }: ABadgeProps) {
  const info = A_INFO[a];
  const giving = info.mode === "giving";
  const tone =
    state === "hit"
      ? "border-good bg-good/15 text-good"
      : state === "miss"
        ? "border-bad bg-bad/15 text-bad"
        : giving
          ? "border-giving/60 bg-giving/15 text-giving"
          : "border-receiving/60 bg-receiving/15 text-receiving";
  const icon = state === "hit" ? "✓" : state === "miss" ? "✗" : null;
  const srState = state === "hit" ? " (hit)" : state === "miss" ? " (missed)" : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold whitespace-nowrap ${tone} ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`inline-block size-2 rounded-[1px] ${giving ? "bg-giving" : "bg-receiving"}`}
      />
      {icon && <span aria-hidden="true">{icon}</span>}
      <span>
        {info.label}
        <span className="sr-only">{srState}</span>
      </span>
    </span>
  );
}
