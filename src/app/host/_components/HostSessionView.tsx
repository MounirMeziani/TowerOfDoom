"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SceneBoundary } from "@/components/climb3d/SceneBoundary";
import { LiveLeaderboard } from "@/components/leaderboard/LiveLeaderboard";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { endSession, resetSession, startSession } from "@/lib/api";
import { useLiveRuns } from "@/lib/leaderboard";
import { broadcastSessionStatus, useLobbyPresence, useSessionStatus } from "@/lib/lobby";
import { getHostKey } from "@/lib/player";
import { useMode2D, useWebGLSupport } from "@/lib/three/support";
import type { LobbyPresence, SessionRow, SessionStatus } from "@/lib/types";
import { storeHostKey, useHostKey } from "../_lib/client-hooks";
import { verifyHostKey, type HostKeyCheck } from "../_lib/verify-host-key";
import { AdminBar, type AdminAction } from "./AdminBar";
import { JoinPanel } from "./JoinPanel";
import { LiveRace } from "./LiveRace";
import { LobbyStage } from "./LobbyStage";
import { SessionStats } from "./SessionStats";

function SceneLoader() {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <span role="status" aria-label="Loading" className="text-5xl motion-safe:animate-pulse">
        🗼
      </span>
    </div>
  );
}

// three.js stays out of the initial bundle: the scenes load on the client only.
const HostLobby3D = dynamic(() => import("./HostLobby3D"), { ssr: false, loading: SceneLoader });
const HostTower3D = dynamic(() => import("./HostTower3D"), { ssr: false, loading: SceneLoader });

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
    !connected ? "Hero list offline. Start anyway?" : n < 2 ? `${n} hero${n === 1 ? "" : "es"}. Start anyway?` : null,
  end: () => "End the session?",
  reset: () => "Reset to lobby?",
};

const STAGE_LOBBY = "h-[min(70vh,52rem)] min-h-[22rem]";
const STAGE_TOWER = "h-[min(78vh,60rem)] min-h-[26rem]";

/** Projector + admin view for one session: 3D lobby, 3D tower race, leaderboard and team mastery. */
export function HostSessionView({ code, initialSession, keyFromUrl, hadKeyParam }: HostSessionViewProps) {
  const router = useRouter();
  const hostKey = useHostKey(code);
  const { session: liveSession, notFound } = useSessionStatus(code);
  const { players, connected } = useLobbyPresence(code, null);
  const live = useLiveRuns(code);
  const webgl = useWebGLSupport();
  const [mode2d, setMode2d] = useMode2D();
  // Sticky for the session: a GPU that crashed one scene is not trusted with the next.
  const [sceneFailed, setSceneFailed] = useState(false);
  const use3D = webgl === true && !mode2d && !sceneFailed;

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
          setError("Invalid admin link");
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
              <h1 className="font-pixel text-base leading-relaxed sm:text-xl">
                <span aria-hidden="true">❓ </span>
                <span className="sr-only">No session </span>
                {code}
              </h1>
              <Button href="/host" size="lg">
                New session
              </Button>
            </>
          ) : (
            <span role="status" aria-label="Loading" className="text-4xl motion-safe:animate-pulse">
              🗼
            </span>
          )}
        </Panel>
      </PageShell>
    );
  }

  const status: SessionStatus = session.status;
  const ended = status === "ended";

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
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  const startLobby = () => void runAction("start");

  return (
    <PageShell wide>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-pixel text-base leading-relaxed text-text sm:text-xl xl:text-2xl">
            {session.name}
          </h1>
          <div className="flex items-center gap-1 print:hidden">
            {webgl === true && !sceneFailed && (
              <button
                type="button"
                onClick={() => setMode2d(!mode2d)}
                aria-pressed={mode2d}
                aria-label="2D mode"
                title="2D"
                className="flex min-h-11 min-w-11 items-center justify-center rounded px-2 font-pixel text-[0.625rem] text-muted hover:bg-surface-2 hover:text-text aria-pressed:text-ember-2"
              >
                2D
              </button>
            )}
            <Link
              href={`/leaderboard?s=${code}`}
              aria-label="Session leaderboard"
              title="Leaderboard"
              className="flex min-h-11 min-w-11 items-center justify-center rounded px-2 text-xl hover:bg-surface-2"
            >
              <span aria-hidden="true">🏆</span>
            </Link>
          </div>
        </header>

        <AdminBar
          code={code}
          status={status}
          hostKey={hostKey}
          busy={busy}
          error={error}
          playerCount={players.length}
          lobbyStageShown={status === "lobby" && webgl !== null}
          onAction={(a) => void runAction(a)}
        />

        {status === "lobby" ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
            <JoinPanel code={code} sessionName={session.name} large />
            {webgl === null ? (
              <div className={`${STAGE_LOBBY} overflow-hidden rounded-lg border-2 border-line`}>
                <SceneLoader />
              </div>
            ) : use3D ? (
              <section
                aria-label="Lobby"
                className={`${STAGE_LOBBY} relative overflow-hidden rounded-lg border-2 border-line shadow-[0_0_60px_-20px_var(--ember)]`}
              >
                <SceneBoundary onError={() => setSceneFailed(true)}>
                  <HostLobby3D
                    code={code}
                    players={players}
                    overlay={
                      <LobbyOverlay
                        count={players.length}
                        connected={connected}
                        canStart={Boolean(hostKey)}
                        starting={busy === "start"}
                        onStart={startLobby}
                      />
                    }
                  />
                </SceneBoundary>
                <HeroList players={players} />
              </section>
            ) : (
              <LobbyStage
                players={players}
                connected={connected}
                canStart={Boolean(hostKey)}
                starting={busy === "start"}
                onStart={startLobby}
              />
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="flex flex-col gap-4">
                {status === "playing" ? (
                  <JoinPanel code={code} sessionName={session.name} />
                ) : (
                  <Panel className="flex flex-col items-center gap-2 text-center">
                    <span aria-hidden="true" className="text-3xl">
                      🏁
                    </span>
                    <p className="font-pixel text-2xl text-gold" aria-label={`Session code ${code.split("").join(" ")}`}>
                      {code}
                    </p>
                  </Panel>
                )}
              </div>
              {webgl === null ? (
                <div className={`${STAGE_TOWER} overflow-hidden rounded-lg border-2 border-line`}>
                  <SceneLoader />
                </div>
              ) : use3D ? (
                <section
                  aria-label={ended ? "Final positions" : "Live race"}
                  className={`${STAGE_TOWER} relative overflow-hidden rounded-lg border-2 border-line`}
                >
                  <SceneBoundary onError={() => setSceneFailed(true)}>
                    <HostTower3D
                      players={players}
                      runs={live.runs}
                      startedAt={session.started_at}
                      ended={ended}
                      overlay={<RaceOverlay players={players} ended={ended} />}
                    />
                  </SceneBoundary>
                  <HeroList players={players} />
                </section>
              ) : (
                <LiveRace players={players} ended={ended} />
              )}
              <Panel className="lg:col-span-2 xl:col-span-1">
                <LiveLeaderboard
                  sessionCode={code}
                  live={live}
                  variant="projector"
                  limit={10}
                  title={ended ? "Final" : "Leaderboard"}
                  emptyMessage={ended ? "No runs." : undefined}
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

/** Big hero count + Start, floating over the 3D lobby. */
function LobbyOverlay({
  count,
  connected,
  canStart,
  starting,
  onStart,
}: {
  count: number;
  connected: boolean;
  canStart: boolean;
  starting: boolean;
  onStart(): void;
}) {
  return (
    <div className="flex h-full flex-col justify-between p-4 xl:p-6">
      <p
        aria-live="polite"
        className="flex w-fit items-center gap-3 rounded-lg border-2 border-line bg-bg/75 px-4 py-2 backdrop-blur-sm"
      >
        <span aria-hidden="true" className="text-3xl xl:text-4xl">
          👥
        </span>
        <span className="font-pixel text-3xl text-text xl:text-5xl">
          {count}
          <span className="sr-only"> {count === 1 ? "hero" : "heroes"} in the lobby</span>
        </span>
        {!connected && (
          <span title="Connecting" className="text-xl motion-safe:animate-pulse">
            <span aria-hidden="true">📡</span>
            <span className="sr-only">Connecting</span>
          </span>
        )}
      </p>
      {canStart && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={onStart}
            disabled={starting}
            aria-label="Start the climb"
            className="min-w-[14rem] py-5 text-base xl:min-w-[20rem] xl:text-xl"
          >
            {starting ? "⏳" : "▶ Start"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Climbing / summit counters over the tower. */
function RaceOverlay({ players, ended }: { players: LobbyPresence[]; ended: boolean }) {
  const climbing = players.filter((p) => p.phase === "playing").length;
  const victors = players.filter(
    (p) => p.phase === "finished" && !(typeof p.hearts === "number" && p.hearts <= 0),
  ).length;
  const chip = "rounded-lg border-2 bg-bg/75 px-3 py-1.5 font-pixel text-xs xl:text-base";
  return (
    <div className="flex flex-wrap gap-2 p-3 xl:p-4">
      {ended && (
        <span className={`${chip} border-gold/60 text-gold`}>
          <span aria-hidden="true">🏁</span>
          <span className="sr-only">Session ended</span>
        </span>
      )}
      <span title="Climbing" className={`${chip} border-line text-text`}>
        <span aria-hidden="true">🧗 </span>
        <span className="sr-only">Climbing: </span>
        {climbing}
      </span>
      <span title="Summit" className={`${chip} border-gold/50 text-gold`}>
        <span aria-hidden="true">👑 </span>
        <span className="sr-only">At the summit: </span>
        {victors}
      </span>
    </div>
  );
}

/** Screen-reader roster for the 3D views. */
function HeroList({ players }: { players: LobbyPresence[] }) {
  return (
    <ul className="sr-only">
      {players.map((p) => (
        <li key={p.playerId}>
          {p.name}
          {p.phase === "playing" && typeof p.floor === "number" ? `, floor ${p.floor}` : ""}
          {p.phase === "finished" ? ", finished" : ""}
        </li>
      ))}
    </ul>
  );
}
