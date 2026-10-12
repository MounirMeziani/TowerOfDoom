"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SessionStatus } from "@/lib/types";
import { copyText, toggleFullscreen, useIsFullscreen, useOrigin } from "../_lib/client-hooks";
import { StatusPill } from "./StatusPill";

export type AdminAction = "start" | "end" | "reset";

export interface AdminBarProps {
  code: string;
  status: SessionStatus;
  hostKey: string | null;
  busy: AdminAction | null;
  error: string | null;
  playerCount: number;
  onAction(action: AdminAction): void;
}

/** Compact control strip. Admin controls only render when this browser holds the host key. */
export function AdminBar({ code, status, hostKey, busy, error, playerCount, onAction }: AdminBarProps) {
  const origin = useOrigin();
  const fullscreen = useIsFullscreen();
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function handleCopy() {
    if (!hostKey || !origin) return;
    const ok = await copyText(`${origin}/host/${code}?k=${encodeURIComponent(hostKey)}`);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div
        role="region"
        aria-label={hostKey ? "Admin controls" : "Spectator view"}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-line bg-surface/90 px-3 py-2"
      >
        <span className="font-pixel text-[0.625rem] uppercase text-muted">{hostKey ? "Admin" : "Spectator"}</span>
        <StatusPill status={status} />
        <span className="text-xs text-muted">
          <span className="font-pixel text-[0.625rem] text-text">{playerCount}</span> online
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hostKey && status === "lobby" && (
            <Button size="md" onClick={() => onAction("start")} disabled={busy !== null}>
              {busy === "start" ? "Starting..." : "Start the Climb"}
            </Button>
          )}
          {hostKey && status === "playing" && (
            <Button variant="danger" size="md" onClick={() => onAction("end")} disabled={busy !== null}>
              {busy === "end" ? "Ending..." : "End session"}
            </Button>
          )}
          {hostKey && status === "ended" && (
            <Button variant="secondary" size="md" onClick={() => onAction("reset")} disabled={busy !== null}>
              {busy === "reset" ? "Resetting..." : "Reset to lobby"}
            </Button>
          )}
          {hostKey && (
            <Button variant="ghost" size="md" onClick={handleCopy} disabled={!origin}>
              {copied === "ok" ? "Copied!" : copied === "fail" ? "Copy failed" : "Copy admin link"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            onClick={() => void toggleFullscreen()}
            aria-pressed={fullscreen}
            title="Toggle fullscreen"
          >
            {fullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {hostKey ? (
        <p className="px-1 text-xs text-muted">
          <span aria-hidden="true">⚠️ </span>
          Anyone with the admin link can start, end or reset this session. Share it only with co-facilitators. The
          projector can open <span className="text-text">/host/{code}</span> without it as a read-only view.
        </p>
      ) : (
        <p className="px-1 text-xs text-muted">
          Read-only view. To control this session from this device, open the admin link from the facilitator&apos;s
          screen.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md border-2 border-bad/60 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {copied === "ok" ? "Admin link copied to clipboard." : copied === "fail" ? "Could not copy the admin link." : ""}
      </p>
    </div>
  );
}
