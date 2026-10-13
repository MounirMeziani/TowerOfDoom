"use client";

// Projector view of the 3D lobby hall: every hero walking live (observer only, never publishes).
// Client-only: load with next/dynamic({ ssr: false }).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { RemoteHeroes } from "@/components/lobby3d/RemoteHeroes";
import { GameCanvas, HeroModel, resetDebug, setDebug } from "@/components/three/kit";
import { LobbyHall, lobbySpawnFor } from "@/components/three/world";
import { isMotionStale, motionStaleMs, useRemoteMotion } from "@/lib/motion-sync";
import type { LobbyPresence } from "@/lib/types";

type MotionMap = ReturnType<typeof useRemoteMotion>;

// Names live in the HeroList / roster; in the hall only the small emoji disc shows.
const LABEL_SIZE = 1.8;
const HERO_SCALE = 1.7; // the projector camera is far away: bigger heroes read across a room
const LOOK_AT: [number, number, number] = [0, 0, -0.5];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Farthest hero from LOOK_AT (xz), over live positions plus spawn slots of heroes not broadcasting. */
function heroExtent(motionRef: MotionMap, roster: LobbyPresence[], now: number): number {
  let ext = 0;
  const map = motionRef.current;
  const staleMs = motionStaleMs(roster.length);
  for (const p of roster) {
    const m = map.get(p.playerId);
    const [x, z] = m && !isMotionStale(m, now, staleMs) ? [m.x, m.z] : lobbySpawnFor(p.playerId);
    ext = Math.max(ext, Math.hypot(x - LOOK_AT[0], z - LOOK_AT[2]));
  }
  return ext;
}

/**
 * Slow overhead orbit (a gentle sway in front of the hall, never behind the back wall).
 * Moves in when only a few heroes are present, eased so it never jumps.
 */
function OrbitCamera({ motionRef, roster }: { motionRef: MotionMap; roster: LobbyPresence[] }) {
  const [reduce] = useState(prefersReducedMotion);
  const radius = useRef<number | null>(null);
  const acc = useRef(1);
  const target = useRef(21);
  useFrame(({ camera, clock, size }, dt) => {
    const t = clock.elapsedTime;
    const a = reduce ? 0 : Math.sin(t * 0.07) * 0.42;
    const portrait = size.width < size.height * 0.95;
    acc.current += dt;
    if (acc.current >= 0.5) {
      acc.current = 0;
      target.current = heroExtent(motionRef, roster, Date.now()) * 1.6;
    }
    // Landscape: 12..21 (h = r*22/21). Portrait keeps its old framing (30/34) as the upper bound.
    const max = portrait ? 30 : 21;
    const min = portrait ? 12 * (30 / 21) : 12;
    const want = Math.min(max, Math.max(min, target.current * (portrait ? 30 / 21 : 1)));
    const cur = radius.current ?? want;
    const r = reduce ? want : cur + (want - cur) * Math.min(1, dt * 1.5);
    radius.current = r;
    const h = portrait ? (r * 34) / 30 : (r * 22) / 21;
    camera.position.set(Math.sin(a) * r, h, LOOK_AT[2] + Math.cos(a) * r);
    camera.lookAt(LOOK_AT[0], LOOK_AT[1], LOOK_AT[2]);
  });
  return null;
}

/**
 * Tracks which roster heroes have live positions (rendered by RemoteHeroes) and which don't
 * (2D-mode players, or not yet broadcasting) so the latter still stand at a spawn point.
 * Also feeds the window.__TOD__ test hook.
 */
function Watcher({
  motionRef,
  roster,
  onMissing,
}: {
  motionRef: MotionMap;
  roster: LobbyPresence[];
  onMissing(ids: string): void;
}) {
  const acc = useRef(0);
  const lastKey = useRef<string | null>(null);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const now = Date.now();
    const map = motionRef.current;
    const staleMs = motionStaleMs(roster.length);
    const remotes: Record<string, { x: number; z: number }> = {};
    const missing: string[] = [];
    let count = 0;
    for (const p of roster) {
      const m = map.get(p.playerId);
      if (m && !isMotionStale(m, now, staleMs)) {
        count++;
        remotes[p.playerId] = { x: Math.round(m.x * 100) / 100, z: Math.round(m.z * 100) / 100 };
      } else {
        missing.push(p.playerId);
      }
    }
    setDebug({ scene: "host", remoteCount: count, rosterCount: roster.length, remotes });
    const key = missing.join(",");
    if (key !== lastKey.current) {
      lastKey.current = key;
      onMissing(key);
    }
  });
  return null;
}

export interface HostLobby3DProps {
  code: string;
  players: LobbyPresence[];
  overlay?: ReactNode;
}

export default function HostLobby3D({ code, players, overlay }: HostLobby3DProps) {
  const motionRef = useRemoteMotion(code, null);
  const [missingKey, setMissingKey] = useState("");

  useEffect(() => {
    resetDebug("host", { remoteCount: 0 });
  }, []);

  const missing = useMemo(() => new Set(missingKey ? missingKey.split(",") : []), [missingKey]);

  return (
    <GameCanvas camera={{ position: [0, 22, 21], fov: 42 }} overlay={overlay} label={`Lobby, ${players.length} heroes`}>
      {/* default fog is tuned for close follow cameras; push it back for the far overhead view */}
      <fog attach="fog" args={["#0b0614", 42, 110]} />
      <OrbitCamera motionRef={motionRef} roster={players} />
      <LobbyHall />
      <RemoteHeroes motionRef={motionRef} roster={players} labelSize={LABEL_SIZE} heroScale={HERO_SCALE} showNames={false} debug={false} nearHide={0} staleMs={motionStaleMs(players.length)} />
      {players.map((p) => {
        if (!missing.has(p.playerId)) return null;
        const [x, z] = lobbySpawnFor(p.playerId);
        return (
          <HeroModel key={p.playerId} heroId={p.heroId} name={p.name} position={[x, 0, z]} rotationY={0} labelSize={LABEL_SIZE} scale={HERO_SCALE} showName={false} />
        );
      })}
      <Watcher motionRef={motionRef} roster={players} onMissing={setMissingKey} />
    </GameCanvas>
  );
}
