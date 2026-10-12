"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LiveLeaderboard } from "@/components/leaderboard/LiveLeaderboard";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { endSession, resetSession, startSession } from "@/lib/api";
import { useLiveRuns } from "@/lib/leaderboard";
import { broadcastSessionStatus, useLobbyPresence, useSessionStatus } from "@/lib/lobby";
import { getHostKey } from "@/lib/player";
import type { SessionRow, SessionStatus } from "@/lib/types";
import { storeHostKey, useHostKey } from "../_lib/client-hooks";
import { verifyHostKey, type HostKeyCheck } from "../_lib/verify-host-key";
import { AdminBar, type AdminAction } from "./AdminBar";
import { JoinPanel } from "./JoinPanel";
import { LiveRace } from "./LiveRace";
import { LobbyStage } from "./LobbyStage";
import { SessionStats } from "./SessionStats";

export interface HostSessionViewProps {
  code: string;
  /** Server-side lookup result; null when the server could not reach the database. */
  initialSession: SessionRow | null;
  /** Valid-looking ?k= admin key from the URL (saved, then stripped). */
  keyFromUrl: string | null;
  /** Whether the URL carried a ?k= param at all (stripped either way). */
  hadKeyParam: boolean;
}

const CONFIRM: Record<AdminAction, (players: number, connected: boolean) => string | null> = {
  start: (n, connected) =>
    !connected
      ? "The live hero list is offline on this screen, so heroes can't be counted here. Heroes in the lobby will still be started. Start the climb anyway?"
      : n < 2
        ? `Only ${n} hero${n === 1 ? " is" : "es are"} in the lobby. Start the climb anyway?`
        : null,
  end: () => "End the session? Heroes still climbing can finish, but the race is over and the projector shows final results.",
  reset: () => "Reset this session to the lobby for another round? Scores from this round stay on the leaderboard.",
};

/** Projector + admin view for one session: lobby, live race, leaderboard and team mastery. */
export function HostSessionView({ code, initialSession, keyFromUrl, hadKeyParam }: HostSessionViewProps) {
  const router = useRouter();
  const hostKey = useHostKey(code);
  const { session: liveSession, notFound } = useSessionStatus(code);
  const { players, connected } = useLobbyPresence(code, null);
  const live = useLiveRuns(code);

  const [busy, setBusy] = useState<AdminAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optimistic status right after an admin action, until the status hook reports anything new.
  const [override, setOverride] = useState<{ row: SessionRow; seen: SessionRow | null } | null>(null);

  // Which session this view still shows ("" once unmounted). Stripping ?k= changes the props and
  // re-runs the effect below, so async results are checked against this instead of an effect cleanup.
  const liveCode = useRef(code);
  useEffect(() => {
    liveCode.current = code;
    return () => {
      liveCode.current = "";
    };
  }, [code]);

  // Admin link: ?k=HOSTKEY -> strip it from the address bar, verify it with the server, and only then
  // save it, so a stale or mistyped link never replaces a working key.
  useEffect(() => {
    if (!hadKeyParam) return;
    router.replace(`/host/${code}`, { scroll: false });
    if (!keyFromUrl) return;
    const held = getHostKey(code);
    if (held === keyFromUrl) return;
    void verifyHostKey(code, keyFromUrl)
      .catch((): HostKeyCheck => "unknown")
      .then((result) => {
        if (liveCode.current !== code) return;
        const current = getHostKey(code);
        if (result === "ok") {
          storeHostKey(code, keyFromUrl);
        } else if (result === "invalid") {
          setError(`That admin link isn't valid for this session.${current ? " Your saved admin key was kept." : ""}`);
        } else if (!current) {
          // Could not check (offline / server error): only fill an empty slot, never replace a key.
          storeHostKey(code, keyFromUrl);
        }
      });
  }, [code, keyFromUrl, hadKeyParam, router]);

  const baseSession = liveSession ?? initialSession;
  const session = override && override.seen === liveSession ? override.row : baseSession;

  if (!session) {
    return (
      <PageShell wide>
        <Panel className="flex flex-col items-start gap-4">
          {notFound ? (
            <>
              <h1 className="font-pixel text-base leading-relaxed sm:text-xl">No session with code {code}</h1>
              <Button href="/host" size="lg">
                Create a session
              </Button>
            </>
          ) : (
            <p role="status" className="text-muted">
              Summoning session {code}...
            </p>
          )}
        </Panel>
      </PageShell>
    );
  }

  const status: SessionStatus = session.status;

  async function runAction(action: AdminAction) {
    if (!hostKey || busy) return;
    const question = CONFIRM[action](players.length, connected);
    if (question && !window.confirm(question)) return;
    setBusy(action);
    setError(null);
    const seen = liveSession;
    try {
      const fn = action === "start" ? startSession : action === "end" ? endSession : resetSession;
      const row = await fn(code, hostKey);
      setOverride({ row, seen });
      await broadcastSessionStatus(code, row.status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(`${msg} If this keeps happening, re-open the admin link for this session.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell wide>
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-pixel text-[0.625rem] uppercase text-muted">Session {code}</p>
            <h1 className="mt-1 truncate font-pixel text-base leading-relaxed text-text sm:text-xl xl:text-2xl">
              {session.name}
            </h1>
          </div>
          <Link
            href={`/leaderboard?s=${code}`}
            className="flex min-h-11 items-center rounded px-2 text-sm text-muted underline-offset-4 hover:text-text hover:underline print:hidden"
          >
            Session leaderboard
          </Link>
        </header>

        <AdminBar
          code={code}
          status={status}
          hostKey={hostKey}
          busy={busy}
          error={error}
          playerCount={players.length}
          onAction={(a) => void runAction(a)}
        />

        {status === "lobby" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <JoinPanel code={code} sessionName={session.name} large />
            <LobbyStage
              players={players}
              connected={connected}
              canStart={Boolean(hostKey)}
              starting={busy === "start"}
              onStart={() => void runAction("start")}
            />
          </div>
        ) : (
          <>
            {status === "ended" && (
              <p
                role="status"
                className="rounded-lg border-2 border-gold/60 bg-gold/10 px-4 py-3 text-center font-pixel text-xs uppercase text-gold xl:text-sm"
              >
                The climb is over. Final standings below.
              </p>
            )}
            <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                {status === "playing" ? (
                  <JoinPanel code={code} sessionName={session.name} />
                ) : (
                  <Panel className="flex flex-col gap-2 text-center">
                    <p className="font-pixel text-[0.625rem] uppercase text-muted">Code</p>
                    <p className="font-pixel text-2xl text-gold">{code}</p>
                    <p className="text-sm text-muted">Session ended. Thanks for climbing!</p>
                  </Panel>
                )}
              </div>
              <LiveRace players={players} ended={status === "ended"} />
              <Panel className="lg:col-span-2 xl:col-span-1">
                <LiveLeaderboard
                  sessionCode={code}
                  live={live}
                  variant="projector"
                  limit={10}
                  title={status === "ended" ? "Final standings" : "Leaderboard"}
                  emptyMessage={status === "ended" ? "No finished runs were recorded in this session." : undefined}
                />
              </Panel>
            </div>
            <SessionStats runs={live.runs} online={players.length} />
          </>
        )}
      </div>
    </PageShell>
  );
}
