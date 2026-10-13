import type { SessionStatus } from "@/lib/types";

// Same icon set as STATUS in src/app/admin/AdminCreate.tsx.
const STYLES: Record<SessionStatus, { icon: string; label: string; cls: string }> = {
  lobby: { icon: "⏳", label: "Lobby", cls: "border-giving/60 bg-giving/15 text-giving" },
  playing: { icon: "▶", label: "Playing", cls: "border-good/60 bg-good/15 text-good" },
  ended: { icon: "🏁", label: "Ended", cls: "border-muted/60 bg-muted/15 text-muted" },
};

export function StatusPill({ status, className = "" }: { status: SessionStatus; className?: string }) {
  const s = STYLES[status] ?? STYLES.lobby;
  return (
    <span
      title={s.label}
      className={`inline-flex items-center gap-1.5 rounded border-2 px-2 py-1 text-sm leading-none ${s.cls} ${className}`.trim()}
    >
      {status === "playing" && <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-good" />}
      <span aria-hidden="true">{s.icon}</span>
      <span className="sr-only">Session status: {s.label}</span>
    </span>
  );
}
