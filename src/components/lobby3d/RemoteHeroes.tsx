"use client";

import { useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CircleGeometry, MeshBasicMaterial, Vector3, type Group } from "three";
import { HeroModel } from "@/components/three/kit/HeroModel";
import { setDebug } from "@/lib/three/debug";
import { dampFactor, type MovementState } from "@/lib/three/movement";
import { isMotionStale, motionStaleMs, type RemoteMotion } from "@/lib/motion-sync";
import type { LobbyPresence } from "@/lib/types";

const CHECK_EVERY_S = 0.25;
const SNAP_DISTANCE = 6;
const MAX_PREDICT_SPEED = 5.4;
// Dead-reckoning horizon: updates can be seconds apart in big sessions (fan-out budget), so glide up
// to this long past the last sample, never further than one observed message gap.
const MAX_PREDICT_S = 1.2;
// Accept velocity estimates from message gaps up to this long.
const MAX_MSG_GAP_S = 8;
const NEAR_HIDE_HYSTERESIS = 0.5;
/** Level of detail around the local hero: at most this many full heroes (with name tags) ... */
const MAX_FULL = 10;
/** ... and only within this distance of the local hero; everyone else renders "lite" without a tag. */
const FULL_RADIUS = 14;

const _tmp = new Vector3();

// Own blob shadow for heroes hidden near the camera (so the player still sees someone is there).
let blobGeo: CircleGeometry | null = null;
let blobMat: MeshBasicMaterial | null = null;
function blob(): { geo: CircleGeometry; mat: MeshBasicMaterial } {
  blobGeo ??= new CircleGeometry(0.48, 18);
  blobMat ??= new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  return { geo: blobGeo, mat: blobMat };
}

export interface RemoteHeroesProps {
  motionRef: MutableRefObject<Map<string, RemoteMotion>>;
  roster: LobbyPresence[];
  /** Name/emoji tag size multiplier (bigger for far projector cameras). */
  labelSize?: number;
  /** Hero size multiplier (the projector view uses bigger heroes). */
  heroScale?: number;
  showNames?: boolean;
  /** Write remoteCount / remotes to window.__TOD__ (default true). */
  debug?: boolean;
  /** Default: motionStaleMs(roster size), so slow heartbeats in big sessions don't hide idle heroes. */
  staleMs?: number;
  /** Called (throttled, only on change) with "|"-joined ids of roster members without live motion. */
  onMissing?: (key: string) => void;
  /**
   * Hide heroes closer than this to the camera (world units; 0 = off). Default 6: in the follow view,
   * heroes between the camera and you would otherwise render huge and cropped.
   */
  nearHide?: number;
  /**
   * The local hero's live state. When set, only the nearest heroes (up to 10, within 14 units) render
   * in full detail with name tags; the rest are "lite". Omit it (projector) to keep everyone full.
   */
  focusRef?: MutableRefObject<MovementState>;
}

/**
 * Every remote player's hero, interpolated toward the latest "pos" broadcast. Place inside <Canvas>.
 * Heroes not in the roster, or silent for longer than staleMs, are hidden.
 */
export function RemoteHeroes({
  motionRef,
  roster,
  labelSize = 1,
  heroScale = 1,
  showNames = true,
  debug = true,
  staleMs: staleMsProp,
  onMissing,
  nearHide = 6,
  focusRef,
}: RemoteHeroesProps) {
  // Visible ids + where each one was when it appeared (captured in useFrame, never read from refs in render).
  const [visible, setVisible] = useState<{ key: string; spawn: Record<string, Spawn> }>({ key: "", spawn: {} });
  const acc = useRef(CHECK_EVERY_S);
  const lastMissing = useRef<string | null>(null);
  // "|"-joined ids that render in full detail (only used when focusRef is set).
  const [nearKey, setNearKey] = useState("");
  // roster may exclude self (player view): +1 so the estimate matches the publishers' roster size
  const staleMs = staleMsProp ?? motionStaleMs(roster.length + 1);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < CHECK_EVERY_S) return;
    acc.current = 0;
    const now = Date.now();
    const map = motionRef.current;
    const ids: string[] = [];
    const remotes: Record<string, { x: number; z: number }> = {};
    const missing: string[] = [];
    for (const p of roster) {
      const m = map.get(p.playerId);
      if (!m || isMotionStale(m, now, staleMs)) {
        missing.push(p.playerId);
        continue;
      }
      ids.push(p.playerId);
      remotes[p.playerId] = { x: m.x, z: m.z };
    }
    const mk = missing.join("|");
    if (onMissing && mk !== lastMissing.current) {
      lastMissing.current = mk;
      onMissing(mk);
    }
    const key = ids.join("|");
    if (key !== visible.key) {
      const spawn: Record<string, Spawn> = {};
      for (const id of ids) {
        const m = map.get(id)!;
        spawn[id] = visible.spawn[id] ?? { x: m.x, z: m.z, rotY: m.rotY, heroId: m.heroId };
      }
      setVisible({ key, spawn });
    }
    if (focusRef) {
      const f = focusRef.current;
      const nk = ids
        .map((id) => ({ id, d: Math.hypot(remotes[id].x - f.x, remotes[id].z - f.z) }))
        .filter((e) => e.d <= FULL_RADIUS)
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX_FULL)
        .map((e) => e.id)
        .sort()
        .join("|");
      if (nk !== nearKey) setNearKey(nk);
    }
    if (debug) setDebug({ remoteCount: ids.length, rosterCount: roster.length, remotes });
  });

  const near = new Set(nearKey ? nearKey.split("|") : []);

  if (!visible.key) return null;
  return (
    <>
      {roster
        .filter((p) => visible.spawn[p.playerId])
        .map((p) => (
          <RemoteHero
            key={p.playerId}
            id={p.playerId}
            name={p.name}
            heroId={p.heroId}
            spawn={visible.spawn[p.playerId]}
            motionRef={motionRef}
            labelSize={labelSize}
            heroScale={heroScale}
            showName={showNames}
            nearHide={nearHide}
            full={!focusRef || near.has(p.playerId)}
          />
        ))}
    </>
  );
}

type Spawn = { x: number; z: number; rotY: number; heroId: string };

function RemoteHero({
  id,
  name,
  heroId,
  spawn,
  motionRef,
  labelSize,
  heroScale,
  showName,
  nearHide,
  full,
}: {
  id: string;
  name: string;
  heroId: string;
  spawn: Spawn;
  motionRef: MutableRefObject<Map<string, RemoteMotion>>;
  labelSize: number;
  heroScale: number;
  showName: boolean;
  nearHide: number;
  full: boolean;
}) {
  const [initial] = useState(spawn);
  const stateRef = useRef<MovementState>({ x: initial.x, z: initial.z, rotY: initial.rotY, moving: false });
  // Too close to the camera: swap the hero (body + label) for its blob shadow. Changes only on a
  // threshold crossing (with hysteresis), so this re-renders rarely.
  const [hiddenAt, setHiddenAt] = useState<[number, number] | null>(null);
  const shadow = useRef<Group>(null);

  useFrame((state, dt) => {
    const s = stateRef.current;
    const m = motionRef.current.get(id);
    if (!m) return;
    const now = Date.now();

    // Light dead-reckoning between samples so 5 Hz (or slower) updates still glide.
    let tx = m.x;
    let tz = m.z;
    const msgDt = (m.lastSeen - m.prevSeen) / 1000;
    if (m.moving && msgDt > 0.05 && msgDt < MAX_MSG_GAP_S) {
      let vx = (m.x - m.prevX) / msgDt;
      let vz = (m.z - m.prevZ) / msgDt;
      const sp = Math.hypot(vx, vz);
      if (sp > MAX_PREDICT_SPEED) {
        vx = (vx / sp) * MAX_PREDICT_SPEED;
        vz = (vz / sp) * MAX_PREDICT_SPEED;
      }
      const ahead = Math.min(MAX_PREDICT_S, msgDt, Math.max(0, (now - m.lastSeen) / 1000));
      tx += vx * ahead;
      tz += vz * ahead;
    }

    const dx = tx - s.x;
    const dz = tz - s.z;
    const dist = Math.hypot(dx, dz);
    if (dist > SNAP_DISTANCE) {
      s.x = tx;
      s.z = tz;
    } else {
      const k = dampFactor(9, dt);
      s.x += dx * k;
      s.z += dz * k;
    }
    const gliding = dist > 0.08;
    s.moving = m.moving || gliding;
    // Face the direction of travel while gliding; otherwise the sender's facing (HeroModel damps it).
    s.rotY = gliding && dist > 0.15 ? Math.atan2(dx, dz) : m.rotY;

    if (nearHide > 0) {
      const d = state.camera.position.distanceTo(_tmp.set(s.x, 1, s.z));
      const hidden = hiddenAt !== null;
      const hide = hidden ? d < nearHide + NEAR_HIDE_HYSTERESIS : d < nearHide;
      if (hide !== hidden) setHiddenAt(hide ? [s.x, s.z] : null);
    } else if (hiddenAt) {
      setHiddenAt(null);
    }
    if (shadow.current) shadow.current.position.set(s.x, 0, s.z);
  });

  if (hiddenAt) {
    const b = blob();
    return (
      <group ref={shadow} position={[hiddenAt[0], 0, hiddenAt[1]]} scale={heroScale}>
        <mesh geometry={b.geo} material={b.mat} rotation-x={-Math.PI / 2} position-y={0.012} renderOrder={1} />
      </group>
    );
  }

  return (
    <HeroModel
      heroId={heroId || initial.heroId}
      name={name}
      position={[initial.x, 0, initial.z]}
      rotationY={initial.rotY}
      motionRef={stateRef}
      showName={showName && full}
      showLabel={full}
      detail={full ? "full" : "lite"}
      labelSize={labelSize}
      scale={heroScale}
    />
  );
}
