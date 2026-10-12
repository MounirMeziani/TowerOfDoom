import type { SessionStatus } from "@/lib/types";

const STYLES: Record<SessionStatus, { label: string; cls: string }> = {
  lobby: { label: "Lobby", cls: "border-giving/60 bg-giving/15 text-giving" },
  playing: { label: "Playing", cls: "border-good/60 bg-good/15 text-good" },
  ended: { label: "Ended", cls: "border-muted/60 bg-muted/15 text-muted" },
};

export function StatusPill({ status, className = "" }: { status: SessionStatus; className?: string }) {
  const s = STYLES[status] ?? STYLES.lobby;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border-2 px-2 py-1 font-pixel text-[0.625rem] uppercase ${s.cls} ${className}`.trim()}
    >
      {status === "playing" && <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-good" />}
      <span className="sr-only">Session status: </span>
      {s.label}
    </span>
  );
}
