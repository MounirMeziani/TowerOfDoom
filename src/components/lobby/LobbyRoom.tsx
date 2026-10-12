"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getHero } from "@/lib/characters";
import { useLobbyPresence, useSessionStatus } from "@/lib/lobby";
import { getHostKey, getPlayer, normalizeSessionCode } from "@/lib/player";
import type { LobbyPresence, Player, SessionStatus } from "@/lib/types";
import { CharacterCreator } from "@/components/character/CharacterCreator";
import { HeroCard } from "@/components/character/HeroCard";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ClimbCountdown } from "./ClimbCountdown";
import { LobbyPlayerGrid } from "./LobbyPlayerGrid";
import { PulsingTower } from "./PulsingTower";
import { TipCarousel } from "./TipCarousel";

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

  /* ---- Render states ---- */

  if (!code || notFound) {
    return (
      <PageShell>
        <Panel className="flex flex-col items-center gap-4 text-center">
          <p className="text-5xl" aria-hidden="true">
            🕳️
          </p>
          <h1 className="font-pixel text-sm leading-relaxed text-ember sm:text-base">That session doesn&apos;t exist</h1>
          <p className="text-muted">
            We couldn&apos;t find a tower with the code{" "}
            <span className="font-pixel text-xs text-text">{code ?? rawCode.slice(0, 12).toUpperCase()}</span>. Double-check the
            code on the big screen, or climb solo.
          </p>
          <Button href="/" size="lg">
            Back to the entrance
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
          <h1 className="font-pixel text-sm leading-relaxed text-ember sm:text-base">This session has ended</h1>
          <p className="text-muted">
            {session?.name ? <>&ldquo;{session.name}&rdquo; is over. </> : null}See how everyone did on the leaderboard.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href={`/leaderboard?s=${code}`} size="lg">
              View leaderboard
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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16" role="status">
          <PulsingTower />
          <p className="font-pixel text-[0.625rem] text-muted uppercase">Finding tower {code}…</p>
        </div>
      </PageShell>
    );
  }

  if (!ready || editing) {
    const joiningLate = status === "playing";
    return (
      <PageShell>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border-2 border-ember/60 bg-ember/10 px-2 py-1 font-pixel text-[0.625rem] text-ember">
              Joining session {code}
            </span>
            {session?.name && <span className="truncate text-sm text-muted">{session.name}</span>}
          </div>
          <Panel className="flex flex-col gap-4">
            <h1 className="font-pixel text-sm leading-relaxed text-text sm:text-base">
              {editing ? "Change your hero" : "Create your hero"}
            </h1>
            <p className="text-sm text-muted">
              {joiningLate
                ? "The climb has already started. Pick a name and a hero, then jump straight in."
                : "Pick a name and a hero. Everyone in the lobby will see them appear on the big screen."}
            </p>
            <CharacterCreator
              initial={player ?? undefined}
              sessionCode={code}
              submitLabel={joiningLate ? "Start Climbing" : editing ? "Save hero" : "Enter the Lobby"}
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

  return (
    <PageShell>
      {showCountdown && <ClimbCountdown onDone={goPlay} />}
      {status === "playing" && lateArrival && (
        <p role="status" className="py-8 text-center font-pixel text-xs text-ember">
          The climb has started. Heading in…
        </p>
      )}

      {/* Inert while the countdown is up so no hidden control can take a key press and abort the start. */}
      <div className="flex flex-col gap-5" inert={showCountdown}>
        {/* Session header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-pixel text-[0.625rem] text-muted uppercase">Session</p>
            <h1 className="truncate text-lg font-bold text-text sm:text-xl">{session?.name ?? "Tower Session"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-muted" title={connected ? "Live" : "Connecting"}>
              <span
                aria-hidden="true"
                className={`inline-block size-2 rounded-full ${connected ? "bg-good" : "animate-pulse bg-gold"}`}
              />
              {connected ? "Live" : "Connecting…"}
            </span>
            <span className="rounded border-2 border-line bg-surface-2 px-2 py-1 font-pixel text-xs text-gold">{code}</span>
          </div>
        </header>

        {/* Waiting banner */}
        <Panel className="flex flex-col items-center gap-4 text-center">
          <PulsingTower />
          <p className="font-pixel text-[0.6875rem] leading-relaxed text-ember sm:text-sm" role="status">
            Waiting for the admin to start the climb…
          </p>
          <p className="text-sm text-muted">Keep this screen open. Your climb begins on everyone&apos;s phone at the same moment.</p>
        </Panel>

        {/* You */}
        <section aria-labelledby="you-heading" className="flex flex-col gap-2">
          <h2 id="you-heading" className="font-pixel text-[0.625rem] text-muted uppercase">
            You
          </h2>
          <HeroCard name={player.name} heroId={hero.id} subtitle={`You · ${hero.name}`} highlight />
          <p className="text-sm text-muted">
            <span className="font-semibold" style={{ color: hero.color }}>
              Perk:
            </span>{" "}
            {hero.perk}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={status === "playing"}
              onClick={() => {
                // Once the climb has started, editing would unmount the countdown and stop goPlay firing.
                if (status !== "playing") setEditing(true);
              }}
            >
              Change hero
            </Button>
            <Button variant="ghost" href="/">
              Leave
            </Button>
            {isAdmin && (
              <Button variant="ghost" href={`/host/${code}`}>
                Admin controls
              </Button>
            )}
          </div>
        </section>

        {/* Everyone */}
        <section aria-labelledby="heroes-heading" className="flex flex-col gap-3">
          <h2 id="heroes-heading" className="flex items-baseline justify-between gap-2">
            <span className="font-pixel text-[0.625rem] text-muted uppercase">Heroes in the lobby</span>
            <span className="font-pixel text-xs text-gold" aria-live="polite">
              {count} {count === 1 ? "hero" : "heroes"}
            </span>
          </h2>
          <LobbyPlayerGrid players={everyone} meId={player.id} />
          {count <= 1 && <p className="text-sm text-muted">You&apos;re the first one here. Others will pop in as they join.</p>}
        </section>

        <TipCarousel />
      </div>
    </PageShell>
  );
}

function noopSubscribe() {
  return () => undefined;
}
