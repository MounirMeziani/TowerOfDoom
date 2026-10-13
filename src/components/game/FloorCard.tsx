import type { Floor, Mode } from "@/lib/types";

/** Small mode icon: 🗣 giving / 👂 receiving (label for screen readers only). */
export function ModeBadge({ mode, className = "" }: { mode: Mode; className?: string }) {
  const giving = mode === "giving";
  const label = giving ? "Giving feedback" : "Receiving feedback";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border-2 text-lg leading-none ${
        giving ? "border-giving/70 bg-giving/15" : "border-receiving/70 bg-receiving/15"
      } ${className}`.trim()}
    >
      {giving ? "🗣" : "👂"}
    </span>
  );
}

export const BOSS_INSTRUCTION = "Write what you'd say.";

/**
 * The question: mode icon, the scenario in plain text (a spot floor's quote is part of the scenario,
 * not a side bubble), and ONE clear question. No villain, department, taunts or subtitles.
 */
export function FloorHeader({ floor, floorNumber, headingId }: { floor: Floor; floorNumber: number; headingId?: string }) {
  const isBoss = floor.kind === "boss";
  const quote = floor.kind === "spot" ? floor.quote : undefined;
  return (
    <div className="flex flex-col gap-3 [@media(max-height:500px)]:gap-2">
      <div className="flex items-start gap-3">
        <ModeBadge mode={floor.mode} />
        <p className="min-w-0 flex-1 text-base leading-relaxed text-text [@media(max-height:500px)]:text-sm [@media(max-height:500px)]:leading-snug">
          <span className="sr-only">
            {isBoss ? "Boss floor" : "Floor"} {floorNumber}.{" "}
          </span>
          {floor.setup}
          {quote && (
            <>
              {" "}
              <span className="font-semibold">{quote}</span>
            </>
          )}
        </p>
      </div>
      <h2 id={headingId} className="text-lg leading-snug font-bold text-text [@media(max-height:500px)]:text-base">
        {isBoss ? BOSS_INSTRUCTION : floor.prompt}
      </h2>
    </div>
  );
}
