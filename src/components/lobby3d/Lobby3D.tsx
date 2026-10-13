"use client";

// 3D lobby: everyone's hero walks around the tower lobby hall; positions sync over the shared
// "lobby:<CODE>" channel. Load with next/dynamic({ ssr: false }).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FollowCamera, type Occluder } from "@/components/three/kit/FollowCamera";
import { GameCanvas } from "@/components/three/kit/GameCanvas";
import { HeroModel } from "@/components/three/kit/HeroModel";
import { MovementDriver } from "@/components/three/kit/MovementDriver";
import { TapToMove } from "@/components/three/kit/TapToMove";
import { useMovementController } from "@/components/three/kit/useMovementController";
import { VirtualJoystick } from "@/components/three/kit/VirtualJoystick";
import { ELEVATOR_POS, LOBBY_BOUNDS, LOBBY_OBSTACLES, LOBBY_PILLARS, LobbyHall, lobbySpawnFor } from "@/components/three/world";
import { getHero } from "@/lib/characters";
import { useMotionPublisher, useRemoteMotion } from "@/lib/motion-sync";
import { resetDebug, setDebug } from "@/lib/three/debug";
import type { MovementState } from "@/lib/three/movement";
import type { LobbyPresence, Player } from "@/lib/types";
import { ClimbCountdown } from "@/components/lobby/ClimbCountdown";
import { RemoteHeroes } from "./RemoteHeroes";

export interface Lobby3DProps {
  code: string;
  player: Player;
  /** Everyone in presence (self included; filtered here). */
  roster: LobbyPresence[];
  count: number;
  connected: boolean;
  sessionName: string | null;
  /** Admin pressed Start: freeze, face the elevator, open doors, count down, then onCountdownDone. */
  countdown: boolean;
  onCountdownDone: () => void;
  /** Already playing (late arrival): frozen, navigating away. */
  leaving: boolean;
  isAdmin: boolean;
  onChangeHero: () => void;
  onUse2D: () => void;
}

/** Pillars lift the follow camera instead of hiding the hero. */
const LOBBY_OCCLUDERS: Occluder[] = LOBBY_PILLARS.map(([x, z]) => [x, z, 0.6]);

const ELEVATOR_FOCUS: [number, number, number] = [ELEVATOR_POS[0], 0, ELEVATOR_POS[1]];
// Lobby framing: lower camera, look point further back and higher, so the elevator "12" sign and the
// Doom Eye sit below the overlay chips and buttons instead of under them.
const CAM_OFFSET: [number, number, number] = [0, 5.4, 8.6];
const CAM_LOOK: [number, number, number] = [0, 1.6, -4.5];
// Portrait phones: the overlay is a larger share of the screen, so look a little lower and further back.
const CAM_LOOK_PORTRAIT: [number, number, number] = [0, 1.2, -5.5];
const DOORS_DELAY_MS = 900;

const iconBtn =
  "flex size-11 items-center justify-center rounded-md border-2 border-line bg-surface/85 text-lg text-text backdrop-blur " +
  "transition-colors hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember " +
  "disabled:opacity-50";

export default function Lobby3D(props: Lobby3DProps) {
  const { code, player, roster, count, connected, sessionName, countdown, onCountdownDone, leaving, isAdmin, onChangeHero, onUse2D } = props;
  const hero = getHero(player.heroId);
  const frozen = countdown || leaving;

  const [start] = useState(() => lobbySpawnFor(player.id));
  const ctrl = useMovementController({ bounds: LOBBY_BOUNDS, obstacles: LOBBY_OBSTACLES, start, enabled: !frozen });

  useMotionPublisher(code, player.id, player.heroId, ctrl.stateRef);
  const motionRef = useRemoteMotion(code, player.id);
  const others = useMemo(() => roster.filter((p) => p.playerId !== player.id && p.phase === "lobby"), [roster, player.id]);
  // Players without live motion (2D mode, no WebGL, not yet heard from) stand at their spawn spot.
  const [missingKey, setMissingKey] = useState("");
  const missing = useMemo(() => new Set(missingKey ? missingKey.split("|") : []), [missingKey]);

  // Elevator doors open shortly after the countdown starts (camera has turned by then).
  const [doorsOpen, setDoorsOpen] = useState(false);
  useEffect(() => {
    if (!countdown) return;
    const t = setTimeout(() => setDoorsOpen(true), DOORS_DELAY_MS);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    const s = ctrl.stateRef.current;
    resetDebug("lobby", { self: { x: s.x, z: s.z }, remoteCount: 0, remotes: {} });
  }, [ctrl]);

  const onUpdate = (s: MovementState) => setDebug({ self: { x: s.x, z: s.z } });

  const overlay = (
    <>
      {countdown && <ClimbCountdown onDone={onCountdownDone} backdrop={false} />}
      <h1 className="sr-only">Lobby {code}</h1>
      <ul className="sr-only" aria-label="Heroes">
        {[{ playerId: player.id, name: player.name }, ...others].map((p) => (
          <li key={p.playerId}>{p.name}</li>
        ))}
      </ul>
      <div
        inert={frozen}
        className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        {/* Session: code + count + waiting */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className="rounded-md border-2 border-gold/60 bg-surface/85 px-2.5 py-1.5 font-pixel text-sm text-gold backdrop-blur"
            title={sessionName ?? undefined}
            aria-label={`Code ${code}`}
          >
            {code}
          </span>
          <span
            className="flex items-center gap-1.5 rounded-md border-2 border-line bg-surface/85 px-2.5 py-1.5 font-pixel text-xs text-text backdrop-blur"
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

        {/* Icon actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={iconBtn} onClick={onChangeHero} aria-label="Change hero" title="Hero" disabled={frozen}>
            <span aria-hidden="true">{hero.emoji}</span>
          </button>
          <button type="button" className={`${iconBtn} font-pixel text-[0.625rem]`} onClick={onUse2D} aria-label="2D mode" title="2D">
            2D
          </button>
          {isAdmin && (
            <Link href={`/host/${code}`} className={iconBtn} aria-label="Admin" title="Admin">
              <span aria-hidden="true">⚙️</span>
            </Link>
          )}
          <Link href="/" className={iconBtn} aria-label="Leave" title="Leave">
            <span aria-hidden="true">🚪</span>
          </Link>
        </div>
      </div>
      {!frozen && <VirtualJoystick ctrl={ctrl} />}
    </>
  );

  return (
    <GameCanvas overlay={overlay} camera={{ position: [0, 7, 14], fov: 50 }} label={`Lobby, ${count} ${count === 1 ? "hero" : "heroes"}`}>
      <LobbyHall elevatorOpen={doorsOpen} />
      <MovementDriver ctrl={ctrl} onUpdate={onUpdate} />
      <HeroModel heroId={hero.id} name={player.name} motionRef={ctrl.stateRef} isSelf position={[start[0], 0, start[1]]} showLabel={!countdown} />
      <RemoteHeroes motionRef={motionRef} roster={others} onMissing={setMissingKey} focusRef={ctrl.stateRef} />
      {others.map((p) => {
        if (!missing.has(p.playerId)) return null;
        const [x, z] = lobbySpawnFor(p.playerId);
        return <HeroModel key={p.playerId} heroId={p.heroId} name={p.name} position={[x, 0, z]} rotationY={0} />;
      })}
      <TapToMove ctrl={ctrl} size={60} />
      <FollowCamera targetRef={ctrl.stateRef} focus={countdown ? ELEVATOR_FOCUS : null} offset={CAM_OFFSET} lookAtOffset={CAM_LOOK} portraitLookAtOffset={CAM_LOOK_PORTRAIT} occluders={LOBBY_OCCLUDERS} />
    </GameCanvas>
  );
}
