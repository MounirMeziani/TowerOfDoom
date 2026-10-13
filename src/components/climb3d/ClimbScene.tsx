"use client";

/**
 * The 3D climb: one floor room at a time. Walk up to the sensei, he greets you, the question opens
 * as a DOM sheet (passed in as `panel`), then the stairs light up and take you to the next floor.
 * The flow itself (phases, engine dispatches) lives in Game; this component renders and reports
 * proximity. Load with next/dynamic({ ssr: false }).
 */

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, type PerspectiveCamera } from "three";
import {
  FollowCamera,
  GameCanvas,
  HeroModel,
  MovementDriver,
  TapToMove,
  VirtualJoystick,
  resetDebug,
  setDebug,
  useMovementController,
  type MovementController,
  type Obstacle,
  type Occluder,
} from "@/components/three/kit";
import {
  ELEVATOR_POS,
  FloorRoom,
  LOBBY_BOUNDS,
  LOBBY_OBSTACLES,
  LOBBY_PILLARS,
  LobbyHall,
  PLAYER_SPAWN,
  ROOM_BOUNDS,
  ROOM_OBSTACLES,
  SENSEI_POS,
  STAIRS_POS,
  STAIRS_RADIUS,
  SenseiModel,
  SpeechBubble,
  TALK_RADIUS,
  VILLAIN_POS,
  VillainFigure,
} from "@/components/three/world";
import { G, PAL, basic, glowTexture } from "@/components/three/world/shared";
import { dampFactor } from "@/lib/three/movement";
import { useCoarsePointer, usePrefersReducedMotion } from "@/lib/three/support";
import type { Floor } from "@/lib/types";
import { dist2D, lavaLevelFor, type ClimbPhase } from "./climbFlow";

export interface ClimbSceneProps {
  heroId: string;
  playerName: string;
  /** The floor in view (0-based index below). */
  floor: Floor;
  floorIndex: number;
  hearts: number;
  maxHearts: number;
  phase: ClimbPhase;
  /** The question (not the reveal) is open: the engine clock is running. */
  questionOpen: boolean;
  hud: ReactNode;
  /** Question / reveal content; null when closed. */
  panel: ReactNode;
  /** Changes whenever the panel shows something new (moves focus into it). */
  panelKey: string;
  /** Entrance controls (solo intro). */
  entrance: ReactNode;
  onTalk: () => void;
  onStairs: () => void;
}

const ENTRANCE_SPOT: [number, number] = [ELEVATOR_POS[0], ELEVATOR_POS[1] + 3.2];
/** Where the hero stands when the question opens without the walk (e.g. switching from 2D mid-floor). */
const TALK_SPOT: [number, number] = [SENSEI_POS[0], SENSEI_POS[1] + 2];
/** The grand sensei is 1.5x: give him a wider berth. */
const BOSS_OBSTACLES: Obstacle[] = ROOM_OBSTACLES.map((o) =>
  o.x === SENSEI_POS[0] && o.z === SENSEI_POS[1] ? { ...o, r: o.r * 1.4 } : o,
);

/** Lobby pillars lift the follow camera instead of hiding the hero. */
const LOBBY_OCCLUDERS: Occluder[] = LOBBY_PILLARS.map(([x, z]) => [x, z, 0.6]);

const SENSEI_GREETING = "Climber!";
const GRAND_GREETING = "Show me!";

type V3 = [number, number, number];

/** Room camera looks a little lower than the kit default so the back-wall sign and the sensei's "!" clear the HUD. */
const ROOM_LOOK: V3 = [0, 1.4, -2.2];

/** Short screens (landscape phones): compact sheet. Arbitrary media variants sort after sm/md, so they win. */
const SHORT = "[@media(max-height:500px)]";

const _q0 = new Quaternion();
const _q1 = new Quaternion();

/**
 * Stairs phase: after the kit's FollowCamera has aimed at the hero, turn the camera toward the
 * midpoint of the hero and the stairs so the glowing doorway stays on screen on portrait phones.
 * Must be mounted after <FollowCamera> (useFrame callbacks run in subscription order).
 */
function StairsAim({ ctrl, active }: { ctrl: MovementController; active: boolean }) {
  const weight = useRef(0);
  useFrame(({ camera }, dt) => {
    const target = active ? 1 : 0;
    weight.current += (target - weight.current) * dampFactor(3, dt);
    if (target === 0 && weight.current < 0.002) {
      weight.current = 0;
      return;
    }
    const s = ctrl.stateRef.current;
    _q0.copy(camera.quaternion);
    camera.lookAt((s.x + STAIRS_POS[0]) / 2, 1, (s.z + STAIRS_POS[1]) / 2);
    _q1.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(_q0, _q1, weight.current);
  });
  return null;
}

/** Gold glow dots from the sensei to the open stairs (the floor's own path points at the sensei). */
function StairsPath() {
  const from: [number, number] = [SENSEI_POS[0], SENSEI_POS[1] + 2];
  const dx = STAIRS_POS[0] - from[0];
  const dz = STAIRS_POS[1] - from[1];
  const len = Math.hypot(dx, dz) || 1;
  const reach = Math.max(0, len - 1.6) / len;
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => {
        const k = ((i + 0.5) / 6) * reach;
        return (
          <mesh
            key={i}
            position={[from[0] + dx * k, 0.013, from[1] + dz * k]}
            scale={[0.35, 1, 0.35]}
            geometry={G.disc(12)}
            material={basic(PAL.gold, { t: Math.min(1, (0.18 + i * 0.03) * 2), add: true, map: glowTexture() })}
          />
        );
      })}
    </group>
  );
}

/** Shifts the rendered image away from the question sheet (up on portrait, left on wide screens). */
function ViewShift({ active }: { active: boolean }) {
  const amount = useRef(0);
  const reduce = usePrefersReducedMotion();
  useFrame(({ camera, size }, dt) => {
    const cam = camera as PerspectiveCamera;
    if (!("isPerspectiveCamera" in cam)) return;
    const wide = size.width >= 768 && size.width / Math.max(1, size.height) >= 1.1;
    const target = active ? (wide ? 0.2 : 0.24) : 0;
    if (reduce) amount.current = target;
    else amount.current += (target - amount.current) * (1 - Math.exp(-6 * Math.min(dt, 0.1)));
    if (target === 0 && Math.abs(amount.current) < 0.002) {
      amount.current = 0;
      if (cam.view?.enabled) cam.clearViewOffset();
      return;
    }
    const w = size.width;
    const h = size.height;
    if (wide) cam.setViewOffset(w, h, w * amount.current, 0, w, h);
    else cam.setViewOffset(w, h, 0, h * amount.current, w, h);
  });
  return null;
}

/** Proximity checks (sensei / stairs) + the Playwright debug hook, once per frame. */
function Proximity({
  ctrl,
  phase,
  floorIndex,
  inLobby,
  questionOpen,
  onTalk,
  onStairs,
}: {
  ctrl: MovementController;
  phase: ClimbPhase;
  floorIndex: number;
  inLobby: boolean;
  questionOpen: boolean;
  onTalk: (x: number, z: number) => void;
  onStairs: () => void;
}) {
  const seen = useRef("");
  const fired = useRef(false);
  useFrame(() => {
    const s = ctrl.stateRef.current;
    const near = !inLobby && dist2D(s.x, s.z, SENSEI_POS[0], SENSEI_POS[1]) < TALK_RADIUS;
    setDebug({ scene: "climb", self: { x: s.x, z: s.z }, floor: floorIndex + 1, nearSensei: near, questionOpen });

    const key = `${floorIndex}:${phase}`;
    if (seen.current !== key) {
      seen.current = key;
      fired.current = false;
    }
    if (fired.current) return;
    if (phase === "explore" && near) {
      fired.current = true;
      onTalk(s.x, s.z);
    } else if (phase === "stairs" && dist2D(s.x, s.z, STAIRS_POS[0], STAIRS_POS[1]) < STAIRS_RADIUS) {
      fired.current = true;
      onStairs();
    }
  });
  return null;
}

function HintButton({
  ref,
  icon,
  label,
  ariaLabel,
  onClick,
}: {
  ref?: Ref<HTMLButtonElement>;
  icon: string;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-full border-2 border-gold/70 bg-bg/80 px-5 font-pixel text-xs text-gold shadow-[0_0_24px_-6px_var(--gold)] backdrop-blur-sm transition-transform active:translate-y-px sm:text-sm"
    >
      <span aria-hidden="true" className="text-base">
        {icon}
      </span>
      <span aria-hidden="true">{label}</span>
    </button>
  );
}

export default function ClimbScene({
  heroId,
  playerName,
  floor,
  floorIndex,
  hearts,
  maxHearts,
  phase,
  questionOpen,
  hud,
  panel,
  panelKey,
  entrance,
  onTalk,
  onStairs,
}: ClimbSceneProps) {
  const inLobby = phase === "entrance" || phase === "entering";
  const isBoss = floor.kind === "boss";
  const canWalk = phase === "explore" || phase === "stairs" || phase === "entering";
  const ctrl = useMovementController({
    bounds: inLobby ? LOBBY_BOUNDS : ROOM_BOUNDS,
    obstacles: inLobby ? LOBBY_OBSTACLES : isBoss ? BOSS_OBSTACLES : ROOM_OBSTACLES,
    start: PLAYER_SPAWN,
    enabled: canWalk,
  });
  const [talkSpot, setTalkSpot] = useState<{ index: number; at: [number, number] } | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const coarse = useCoarsePointer();

  // ---- Place the hero when the scene / floor changes -----------------------------------------
  const placeKey = inLobby ? "lobby" : `room:${floorIndex}`;
  const placed = useRef<string | null>(null);
  useEffect(() => {
    if (placed.current === placeKey) return;
    placed.current = placeKey;
    if (inLobby) ctrl.teleport(ENTRANCE_SPOT[0], ENTRANCE_SPOT[1], 0);
    else if (phase === "explore") ctrl.teleport(PLAYER_SPAWN[0], PLAYER_SPAWN[1], Math.PI);
    else ctrl.teleport(TALK_SPOT[0], TALK_SPOT[1], Math.PI);
  }, [placeKey, inLobby, phase, ctrl]);

  // Elevator ride: walk into the open doors.
  useEffect(() => {
    if (phase !== "entering") return;
    const id = window.setTimeout(() => ctrl.walkTo(ELEVATOR_POS[0], ELEVATOR_POS[1]), 120);
    return () => window.clearTimeout(id);
  }, [phase, ctrl]);

  useEffect(() => {
    resetDebug("climb", { floor: floorIndex + 1, nearSensei: false, questionOpen: false });
    // Only on mount: later updates are merged by <Proximity>.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-walk: button, E or Enter -----------------------------------------------------------
  const autoWalk = () => {
    if (phase === "explore") ctrl.walkTo(SENSEI_POS[0], SENSEI_POS[1]);
    else if (phase === "stairs") ctrl.walkTo(STAIRS_POS[0], STAIRS_POS[1]);
  };
  useEffect(() => {
    if (phase !== "explore" && phase !== "stairs") return;
    const target = phase === "explore" ? SENSEI_POS : STAIRS_POS;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === "e" || (key === "enter" && tag !== "BUTTON" && tag !== "A")) {
        e.preventDefault();
        ctrl.walkTo(target[0], target[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, ctrl]);

  // ---- Focus moves into the sheet when it shows something new ----------------------------------
  const sheetOpen = panel !== null && panel !== undefined && panel !== false;
  useEffect(() => {
    if (!sheetOpen) return;
    const el = sheetRef.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [sheetOpen, panelKey]);

  // ---- Sheet closed (stairs) or a new floor: focus the hint chip so it is announced -------------
  useEffect(() => {
    if (phase !== "explore" && phase !== "stairs") return;
    const a = document.activeElement;
    if (a && a !== document.body) return; // don't steal focus from e.g. the HUD menu
    hintRef.current?.focus({ preventScroll: true });
  }, [phase, floorIndex]);

  // ---- Derived scene state ---------------------------------------------------------------------
  const talking = phase === "talk" || phase === "engaged";
  const senseiLook: [number, number] | null = talking
    ? talkSpot && talkSpot.index === floorIndex
      ? talkSpot.at
      : TALK_SPOT
    : null;
  const focus: V3 | null = talking ? [SENSEI_POS[0], isBoss ? 0.6 : 0, SENSEI_POS[1]] : null;
  const rising = phase === "transition" || phase === "entering";
  const camOffset: V3 = inLobby && !rising ? [-1.2, 3.6, 7] : rising ? [0, 11, 4.5] : [0, 6.2, 8.4];
  const fadeOut = rising;

  const overlay = (
    <div className="absolute inset-0 flex flex-col">
      {!inLobby && hud}

      {/* Hint chips (auto-walk) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:justify-end">
        {phase === "explore" && (
          <HintButton ref={hintRef} icon="💬" label={coarse ? "Talk" : "E · Talk"} ariaLabel="Walk to the sensei (E)" onClick={autoWalk} />
        )}
        {phase === "stairs" && <HintButton ref={hintRef} icon="⬆" label="Stairs" ariaLabel="Walk to the stairs (E)" onClick={autoWalk} />}
        {phase === "entrance" && entrance}
      </div>

      {canWalk && !inLobby && <VirtualJoystick ctrl={ctrl} />}

      {/* Question / reveal sheet: bottom on phones, right column on wide screens */}
      {sheetOpen && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:top-20 md:right-0 md:left-auto md:w-[min(32rem,48vw)] md:items-start md:p-4 ${SHORT}:p-2 ${SHORT}:pb-[max(0.5rem,env(safe-area-inset-bottom))] ${SHORT}:md:top-[4.75rem]`}
        >
          <section
            ref={sheetRef}
            key={panelKey}
            role="dialog"
            aria-modal="false"
            aria-label={questionOpen ? "Question" : "Result"}
            tabIndex={-1}
            className={`pointer-events-auto flex max-h-[min(75dvh,calc(100dvh-5.5rem))] w-full max-w-xl flex-col gap-4 overflow-y-auto overscroll-contain rounded-xl border-2 bg-surface/95 p-4 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.8)] outline-none backdrop-blur-sm sm:p-5 md:max-h-[calc(100dvh-6rem)] ${SHORT}:gap-2 ${SHORT}:p-3 ${SHORT}:text-sm ${
              isBoss ? "border-gold/60" : "border-line"
            }`}
            style={{ touchAction: "pan-y" }}
          >
            {panel}
            {/* Scroll cue: fades the bottom edge while more content sits below it */}
            <div
              aria-hidden="true"
              className={`pointer-events-none sticky -bottom-4 -mx-4 -mt-4 -mb-4 h-6 shrink-0 bg-gradient-to-t from-surface to-transparent sm:-bottom-5 sm:-mx-5 sm:-mb-5 ${SHORT}:-bottom-3 ${SHORT}:-mx-3 ${SHORT}:-mt-2 ${SHORT}:-mb-3`}
            />
          </section>
        </div>
      )}

      {/* Fade for floor changes / the elevator ride */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-bg transition-opacity duration-300 ${fadeOut ? "opacity-100 delay-300" : "opacity-0"}`}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-0 overscroll-none">
      <p className="sr-only" aria-live="polite">
        {inLobby ? "" : phase === "stairs" ? "Stairs open" : phase === "explore" ? `Floor ${floorIndex + 1}` : ""}
      </p>
      <h1 className="sr-only">
        {inLobby ? "Tower entrance" : `Floor ${floorIndex + 1}`} · {playerName}
      </h1>
      <GameCanvas
        overlay={overlay}
        camera={{ position: [0, 6.2, 15], fov: 50 }}
        label={inLobby ? "Tower entrance" : `Floor ${floorIndex + 1}`}
      >
        {inLobby ? (
          <LobbyHall elevatorOpen={phase === "entering"} />
        ) : (
          <>
            <FloorRoom
              floorNumber={floorIndex + 1}
              department={floor.department}
              mode={floor.mode}
              isBoss={isBoss}
              lavaLevel={lavaLevelFor(hearts, maxHearts)}
              stairsOpen={phase === "stairs" || phase === "transition"}
            />
            <SenseiModel
              position={[SENSEI_POS[0], 0, SENSEI_POS[1]]}
              variant={isBoss ? "grand" : "sensei"}
              talking={talking}
              waiting={phase === "explore"}
              lookAt={senseiLook}
            />
            {phase === "talk" && (
              <SpeechBubble text={isBoss ? GRAND_GREETING : SENSEI_GREETING} position={[SENSEI_POS[0] + 0.9, isBoss ? 3.0 : 2.35, SENSEI_POS[1]]} />
            )}
            <VillainFigure emoji={floor.villain.emoji} name={floor.villain.name} position={[VILLAIN_POS[0], 0, VILLAIN_POS[1]]} scale={isBoss ? 1.25 : 1} />
            {(phase === "stairs" || phase === "transition") && <StairsPath />}
            <TapToMove ctrl={ctrl} />
          </>
        )}
        <HeroModel
          heroId={heroId}
          name={playerName}
          motionRef={ctrl.stateRef}
          isSelf
          showName
          hideLabel={talking || sheetOpen || focus != null}
        />
        <MovementDriver ctrl={ctrl} />
        <Proximity
          ctrl={ctrl}
          phase={phase}
          floorIndex={floorIndex}
          inLobby={inLobby}
          questionOpen={questionOpen}
          onTalk={(x, z) => {
            // Stop and face the sensei.
            ctrl.teleport(x, z, Math.atan2(SENSEI_POS[0] - x, SENSEI_POS[1] - z));
            setTalkSpot({ index: floorIndex, at: [x, z] });
            onTalk();
          }}
          onStairs={onStairs}
        />
        <FollowCamera
          targetRef={ctrl.stateRef}
          offset={camOffset}
          lookAtOffset={inLobby || rising ? undefined : ROOM_LOOK}
          focus={focus}
          lerp={rising ? 2.5 : 5}
          occluders={inLobby ? LOBBY_OCCLUDERS : undefined}
        />
        <StairsAim ctrl={ctrl} active={phase === "stairs"} />
        <ViewShift active={sheetOpen} />
      </GameCanvas>
    </div>
  );
}
