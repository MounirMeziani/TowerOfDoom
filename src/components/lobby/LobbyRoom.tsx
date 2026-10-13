"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getHero } from "@/lib/characters";
import { useLobbyPresence, useSessionStatus } from "@/lib/lobby";
import { getHostKey, getPlayer, normalizeSessionCode } from "@/lib/player";
import { useMode2D, useWebGLSupport } from "@/lib/three/support";
import type { LobbyPresence, Player, SessionStatus } from "@/lib/types";
import { CharacterCreator } from "@/components/character/CharacterCreator";
import { SceneBoundary } from "@/components/climb3d/SceneBoundary";
import { HeroCard } from "@/components/character/HeroCard";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ClimbCountdown } from "./ClimbCountdown";
import { LobbyPlayerGrid } from "./LobbyPlayerGrid";
import { PulsingTower } from "./PulsingTower";

// Three.js stays out of this route's main bundle: the 3D scene is client-only and loaded on demand.
const Lobby3D = dynamic(() => import("@/components/lobby3d/Lobby3D"), {
  ssr: false,
  loading: () => <FullLoader />,
});

function FullLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg" role="status" aria-label="Loading">
      <PulsingTower />
    </div>
  );
}

/* ---- localStorage-backed player snapshot (hydration-safe) ---- */

const PLAYER_KEY = "tod.player";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readPlayerRaw(): string | null {
  try {
    return window.localStorage.getItem(PLAYER_KEY);
  } catch {
    return null;
  }
}
const SERVER_SNAPSHOT = "__ssr__";

/* ---- Screen-wake lock while waiting (nice-to-have; errors ignored) ---- */

interface WakeLockSentinelLike {
  release(): Promise<void>;
}
type WakeLockNavigator = Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } };

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) void s.release().catch(() => undefined);
        else sentinel = s;
      } catch {
        // denied / unsupported: ignore
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
}

/* ---- Lobby room ---- */

export function LobbyRoom({ rawCode }: { rawCode: string }) {
  const router = useRouter();
  const code = normalizeSessionCode(rawCode);

  const storedRaw = useSyncExternalStore(subscribeStorage, readPlayerRaw, () => SERVER_SNAPSHOT);
  const hydrated = storedRaw !== SERVER_SNAPSHOT;
  const storedPlayer = useMemo(() => (storedRaw === SERVER_SNAPSHOT ? null : getPlayer()), [storedRaw]);
  const [savedPlayer, setSavedPlayer] = useState<Player | null>(null);
  const player = savedPlayer ?? storedPlayer;
  const [editing, setEditing] = useState(false);
  const [joinedAt] = useState(() => new Date().toISOString());
  const isAdmin = useSyncExternalStore(
    noopSubscribe,
    () => (code ? getHostKey(code) !== null : false),
    () => false,
  );

  const ready = !!player && !!code && player.sessionCode === code && player.name.trim().length > 0 && !!player.heroId;

  const { session, loading, notFound } = useSessionStatus(code);
  const status: SessionStatus | null = session?.status ?? null;

  // Remember the first status we saw: arriving while already "playing" skips the countdown.
  const [firstStatus, setFirstStatus] = useState<SessionStatus | null>(null);
  if (status && firstStatus === null) setFirstStatus(status);
  const lateArrival = firstStatus === "playing";

  const inLobby = !!code && !notFound && status !== "ended";
  const me: LobbyPresence | null = useMemo(
    () =>
      ready && inLobby && player
        ? { playerId: player.id, name: player.name, heroId: player.heroId, phase: "lobby", joinedAt }
        : null,
    [ready, inLobby, player, joinedAt],
  );
  const { players, connected } = useLobbyPresence(inLobby ? code : null, me);

  const everyone = useMemo(() => {
    if (!me || players.some((p) => p.playerId === me.playerId)) return players;
    return [...players, me];
  }, [players, me]);

  const goPlay = useCallback(() => router.push("/play"), [router]);

  // Late arrival (already playing) with a character: straight to /play.
  useEffect(() => {
    if (status === "playing" && lateArrival && ready && !editing) router.replace("/play");
  }, [status, lateArrival, ready, editing, router]);

  const waiting = ready && !editing && status === "lobby";
  useWakeLock(waiting);

  const webgl = useWebGLSupport();
  const [mode2d, setMode2d] = useMode2D();
  // A crashed 3D scene (chunk load, WebGL renderer, render error) drops to 2D for this visit only,
  // without saving the 2D preference.
  const [sceneFailed, setSceneFailed] = useState(false);
  const use3D = webgl === true && !mode2d && !sceneFailed;

  /* ---- Render states (minimal text: icons, numbers, 1-2 word labels) ---- */

  if (!code || notFound) {
    return (
      <PageShell>
        <Panel className="flex flex-col items-center gap-4 text-center">
          <p className="text-5xl" aria-hidden="true">
            🕳️
          </p>
          <h1 className="font-pixel text-sm leading-relaxed text-ember sm:text-base">
            <span className="sr-only">No session </span>
            {code ?? rawCode.slice(0, 12).toUpperCase()}
            <span aria-hidden="true"> ✗</span>
          </h1>
          <Button href="/" size="lg">
            Home
          </Button>
        </Panel>
      </PageShell>
    );
  }

  if (status === "ended") {
    return (
      <PageShell>
        <Panel className="flex flex-col items-center gap-4 text-center">
          <p className="text-5xl" aria-hidden="true">
            🏁
          </p>
          <h1 className="font-pixel text-sm leading-relaxed text-ember sm:text-base">Ended</h1>
          {session?.name ? <p className="text-muted">{session.name}</p> : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button href={`/leaderboard?s=${code}`} size="lg">
              Leaderboard
            </Button>
            <Button href="/" variant="secondary" size="lg">
              Home
            </Button>
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (!hydrated || (loading && !session)) {
    return (
      <PageShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16" role="status" aria-label="Loading">
          <PulsingTower />
          <p className="font-pixel text-[0.625rem] text-muted" aria-hidden="true">
            {code}
          </p>
        </div>
      </PageShell>
    );
  }

  if (!ready || editing) {
    const joiningLate = status === "playing";
    return (
      <PageShell>
        <div className="flex flex-col gap-4">
          <span
            className="self-start rounded border-2 border-ember/60 bg-ember/10 px-2 py-1 font-pixel text-[0.625rem] text-ember"
            title={session?.name ?? undefined}
          >
            {code}
          </span>
          <Panel className="flex flex-col gap-4">
            <h1 className="sr-only">{editing ? "Change your hero" : "Create your hero"}</h1>
            <CharacterCreator
              initial={player ?? undefined}
              sessionCode={code}
              submitLabel={editing ? "Save" : "Go"}
              onDone={(p) => {
                setSavedPlayer(p);
                setEditing(false);
                if (joiningLate) router.push("/play");
              }}
            />
            {editing && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </Panel>
        </div>
      </PageShell>
    );
  }

  if (!player) return null;
  const hero = getHero(player.heroId);
  const count = everyone.length;
  const showCountdown = status === "playing" && !lateArrival;
  const leaving = status === "playing" && lateArrival;

  if (webgl === null) return <FullLoader />;

  if (use3D) {
    return (
      <div className="fixed inset-0 h-dvh w-full overflow-hidden overscroll-none bg-bg">
        <SceneBoundary onError={() => setSceneFailed(true)} fallback={<FullLoader />}>
          <Lobby3D
            code={code}
            player={player}
            roster={everyone}
            count={count}
            connected={connected}
            sessionName={session?.name ?? null}
            countdown={showCountdown}
            onCountdownDone={goPlay}
            leaving={leaving}
            isAdmin={isAdmin}
            onChangeHero={() => {
              // Once the climb has started, editing would unmount the countdown and stop goPlay firing.
              if (status !== "playing") setEditing(true);
            }}
            onUse2D={() => setMode2d(true)}
          />
        </SceneBoundary>
      </div>
    );
  }

  return (
    <PageShell>
      {showCountdown && <ClimbCountdown onDone={goPlay} />}
      {leaving && (
        <div role="status" aria-label="Starting" className="flex justify-center py-8">
          <PulsingTower />
        </div>
      )}

      {/* Inert while the countdown is up so no hidden control can take a key press and abort the start. */}
      <div className="flex flex-col gap-5" inert={showCountdown}>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="rounded border-2 border-line bg-surface-2 px-2 py-1 font-pixel text-sm text-gold"
              aria-label={`Code ${code}`}
            >
              {code}
            </span>
            {session?.name && <h1 className="truncate text-base font-bold text-text">{session.name}</h1>}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 font-pixel text-xs text-gold"
              aria-label={`${count} ${count === 1 ? "hero" : "heroes"}`}
              aria-live="polite"
              title={connected ? "Live" : "Connecting"}
            >
              <span aria-hidden="true">👥</span>
              <span aria-hidden="true">{count}</span>
              <span
                aria-hidden="true"
                className={`inline-block size-2 rounded-full ${connected ? "bg-good" : "animate-pulse bg-gold"}`}
              />
            </span>
            <span role="status" aria-label="Waiting for start" title="Waiting" className="animate-pulse text-xl">
              <span aria-hidden="true">⏳</span>
            </span>
          </div>
        </header>

        <div className="flex justify-center py-2">
          <PulsingTower />
        </div>

        <section aria-label="You" className="flex flex-col gap-2">
          <HeroCard name={player.name} heroId={hero.id} subtitle={hero.name} highlight />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={status === "playing"}
              onClick={() => {
                // Once the climb has started, editing would unmount the countdown and stop goPlay firing.
                if (status !== "playing") setEditing(true);
              }}
            >
              Hero
            </Button>
            {webgl && (
              <Button variant="secondary" onClick={() => setMode2d(false)} aria-label="3D mode">
                3D
              </Button>
            )}
            <Button variant="ghost" href="/">
              Leave
            </Button>
            {isAdmin && (
              <Button variant="ghost" href={`/host/${code}`}>
                Admin
              </Button>
            )}
          </div>
        </section>

        <section aria-label="Heroes" className="flex flex-col gap-3">
          <LobbyPlayerGrid players={everyone} meId={player.id} />
        </section>
      </div>
    </PageShell>
  );
}

function noopSubscribe() {
  return () => undefined;
}
