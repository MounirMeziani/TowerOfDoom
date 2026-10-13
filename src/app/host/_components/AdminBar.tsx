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
  /** The lobby stage (3D overlay or 2D LobbyStage) already shows its own count and Start. */
  lobbyStageShown?: boolean;
  onAction(action: AdminAction): void;
}

/** Compact control strip. Admin controls only render when this browser holds the host key. */
export function AdminBar({ code, status, hostKey, busy, error, playerCount, lobbyStageShown = false, onAction }: AdminBarProps) {
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
        aria-label={hostKey ? "Admin controls" : "Read-only view"}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border-2 border-line bg-surface/90 px-3 py-2"
      >
        {!hostKey && (
          <span title="Read-only" className="text-base">
            <span aria-hidden="true">👁</span>
            <span className="sr-only">Read-only view</span>
          </span>
        )}
        <StatusPill status={status} />
        {!lobbyStageShown && (
          <span className="text-xs text-muted" title="Online">
            <span aria-hidden="true">👥 </span>
            <span className="font-pixel text-[0.625rem] text-text">{playerCount}</span>
            <span className="sr-only"> online</span>
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hostKey && status === "lobby" && !lobbyStageShown && (
            <Button size="md" onClick={() => onAction("start")} disabled={busy !== null} aria-label="Start the climb">
              {busy === "start" ? "⏳" : "▶ Start"}
            </Button>
          )}
          {hostKey && status === "playing" && (
            <Button variant="danger" size="md" onClick={() => onAction("end")} disabled={busy !== null} aria-label="End session">
              {busy === "end" ? "⏳" : "■ End"}
            </Button>
          )}
          {hostKey && status === "ended" && (
            <Button variant="secondary" size="md" onClick={() => onAction("reset")} disabled={busy !== null} aria-label="Reset to lobby">
              {busy === "reset" ? "⏳" : "↺ Reset"}
            </Button>
          )}
          {hostKey && (
            <Button
              variant="ghost"
              size="md"
              onClick={handleCopy}
              disabled={!origin}
              aria-label="Copy admin link"
              title="Admin link: anyone with it can start, end or reset. Share only with co-facilitators."
            >
              {copied === "ok" ? "✓" : copied === "fail" ? "✗" : <span aria-hidden="true">🔗</span>}
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            onClick={() => void toggleFullscreen()}
            aria-pressed={fullscreen}
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            <span aria-hidden="true" className="text-base">{fullscreen ? "🗗" : "⛶"}</span>
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border-2 border-bad/60 bg-bad/10 px-3 py-2 text-sm text-bad">
          <span aria-hidden="true">✗ </span>
          {error}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {copied === "ok" ? "Admin link copied to clipboard." : copied === "fail" ? "Could not copy the admin link." : ""}
      </p>
    </div>
  );
}
