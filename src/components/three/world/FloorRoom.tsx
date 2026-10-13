"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Mode } from "@/lib/types";
import { BlobShadow, Bl, Bx, Cn, Cy, Glow, Pl, Tp } from "./prims";
import { ROOM_BAND_X, STAIRS_POS, SENSEI_POS, PLAYER_SPAWN } from "./constants";
import { G, PAL, basic, glowTexture, hashString, labelTexture, lavaTexture, rng, std, stormTexture } from "./shared";

export interface FloorRoomProps {
  floorNumber: number;
  department: string;
  mode: Mode;
  isBoss: boolean;
  /** 0..1 — how high the lava has risen (hearts lost). */
  lavaLevel: number;
  /** Stairs to the next floor glow gold when open. */
  stairsOpen: boolean;
}

interface Theme {
  wall: string;
  trim: string;
  floorA: string;
  floorB: string;
  wood: string;
  metal: string;
  accent: string;
  screen: string;
}

const THEMES: Theme[] = [
  { wall: "#2e2550", trim: "#4a3b7a", floorA: "#241b3d", floorB: "#2f2550", wood: "#6b4a33", metal: "#56507a", accent: "#7aa2ff", screen: "#7ad7ff" },
  { wall: "#1f3a36", trim: "#2f5a4f", floorA: "#17302b", floorB: "#1f3d37", wood: "#5e4630", metal: "#4d6b66", accent: "#3ddc97", screen: "#8affc9" },
  { wall: "#43242a", trim: "#6b3434", floorA: "#2f1a1f", floorB: "#3b2228", wood: "#7a5235", metal: "#6b5458", accent: "#ff9a3d", screen: "#ffc27a" },
  { wall: "#22304f", trim: "#33467a", floorA: "#1a2440", floorB: "#22304f", wood: "#5a4535", metal: "#4f5d80", accent: "#4cc9f0", screen: "#9be7ff" },
  { wall: "#3b2348", trim: "#5c3570", floorA: "#2a1a35", floorB: "#352242", wood: "#6a4636", metal: "#685479", accent: "#c77dff", screen: "#e2b8ff" },
  { wall: "#3d3420", trim: "#62532a", floorA: "#2b2516", floorB: "#373020", wood: "#7d5a33", metal: "#6e6650", accent: "#ffcf4a", screen: "#ffe69a" },
];

const BOSS_THEME: Theme = {
  wall: "#2a1020",
  trim: "#4a1a2a",
  floorA: "#1c0c16",
  floorB: "#281220",
  wood: "#3a1a14",
  metal: "#5a3a3a",
  accent: PAL.ember,
  screen: PAL.ember2,
};

const HW = 7; // half width
const HD = 9; // half depth
const WALL_H = 5;

/**
 * One floor of the tower as a walkable room (~14 x 18). Props and colors vary deterministically
 * with `department`; boss floors become an ember-lit boardroom dojo with a red carpet.
 * Includes its own lights. The sensei and villain are placed by the caller.
 */
export function FloorRoom({ floorNumber, department, mode, isBoss, lavaLevel, stairsOpen }: FloorRoomProps) {
  // Seed mixes department + floor so floors sharing a department still get distinct layouts;
  // the palette cycles by floor number so neighbouring floors never look identical.
  const seed = (hashString(department || "floor") ^ Math.imul(floorNumber, 0x9e3779b1)) >>> 0;
  const theme = isBoss ? BOSS_THEME : THEMES[(Math.max(1, floorNumber) - 1) % THEMES.length];
  const accent = mode === "giving" ? PAL.giving : PAL.receiving;
  const lava = Math.min(1, Math.max(0, lavaLevel || 0));

  return (
    <group>
      <RoomLights accent={accent} isBoss={isBoss} lava={lava} />
      <TileFloor theme={theme} seed={seed} lava={lava} />
      <Lava level={lava} />
      <RoomWalls theme={theme} accent={accent} floorNumber={floorNumber} isBoss={isBoss} seed={seed} />
      {isBoss ? <BossProps /> : <OfficeProps theme={theme} seed={seed} />}
      {!isBoss && <CeilingLights />}
      <SenseiSpot accent={isBoss ? PAL.gold : accent} stairsOpen={stairsOpen} />
      <Stairs open={stairsOpen} />
    </group>
  );
}

// ------------------------------------------------------------------ lights

function RoomLights({ accent, isBoss, lava }: { accent: string; isBoss: boolean; lava: number }) {
  const lavaLight = useRef<THREE.PointLight>(null);
  useFrame((state, dt) => {
    const l = lavaLight.current;
    if (!l) return;
    const target = 3 + lava * 26;
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 5.3) * 0.06 + Math.sin(state.clock.elapsedTime * 13.1) * 0.04;
    l.intensity += (target * flicker - l.intensity) * (1 - Math.exp(-3 * Math.min(dt, 0.1)));
  });
  return (
    <>
      <hemisphereLight args={[isBoss ? "#a0566a" : "#8a78c8", "#1a0d24", isBoss ? 0.7 : 1]} />
      <ambientLight intensity={isBoss ? 0.18 : 0.28} color="#c9b8f0" />
      <directionalLight position={[-5, 10, 8]} intensity={isBoss ? 0.7 : 1.1} color="#ffd2b0" />
      <directionalLight position={[6, 6, -10]} intensity={0.55} color={isBoss ? PAL.ember : "#8fa6ff"} />
      <pointLight position={[SENSEI_POS[0], 2.6, SENSEI_POS[1] + 1.2]} intensity={isBoss ? 20 : 12} distance={10} decay={2} color={isBoss ? PAL.gold : accent} />
      <pointLight ref={lavaLight} position={[0, 0.6, HD - 1]} intensity={3} distance={14} decay={2} color={PAL.ember} />
    </>
  );
}

// ------------------------------------------------------------------ floor + lava

const TILE = 1;
const COLS = HW * 2;
const ROWS = HD * 2;
const TILE_COUNT = COLS * ROWS;

function TileFloor({ theme, seed, lava }: { theme: Theme; seed: number; lava: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const mat = std("#ffffff", { r: 0.55, m: 0.1 });

  // Edge tiles (outer columns + front row) crumble into the lava, in a seeded order.
  const crumbleOrder = useMemo(() => {
    const r = rng(seed ^ 0x5eed);
    const list: number[] = [];
    for (let i = 0; i < COLS; i++)
      for (let j = 0; j < ROWS; j++) {
        if (i === 0 || i === COLS - 1 || j === ROWS - 1) list.push(i * ROWS + j);
      }
    return list
      .map((idx) => ({ idx, k: r() }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.idx);
  }, [seed]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const a = new THREE.Color(theme.floorA);
    const b = new THREE.Color(theme.floorB);
    const sunk = new Set(crumbleOrder.slice(0, Math.round(lava * crumbleOrder.length * 0.75)));
    for (let i = 0; i < COLS; i++)
      for (let j = 0; j < ROWS; j++) {
        const idx = i * ROWS + j;
        const x = -HW + TILE / 2 + i * TILE;
        const z = -HD + TILE / 2 + j * TILE;
        const drop = sunk.has(idx) ? -0.85 : 0;
        m.makeScale(TILE - 0.06, 0.3, TILE - 0.06).setPosition(x, -0.15 + drop, z);
        mesh.setMatrixAt(idx, m);
        c.copy((i + j) % 2 === 0 ? a : b);
        mesh.setColorAt(idx, c);
      }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [theme, crumbleOrder, lava]);

  return (
    <group>
      <instancedMesh ref={ref} args={[G.box(), mat, TILE_COUNT]} />
    </group>
  );
}

function Lava({ level }: { level: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => {
    const t = lavaTexture();
    t.repeat.set(6, 6);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const g = groupRef.current;
    if (g) {
      const target = -0.9 + level * 0.85 + Math.sin(t * 1.2) * 0.012;
      g.position.y += (target - g.position.y) * (1 - Math.exp(-1.5 * Math.min(dt, 0.1)));
    }
    const mat = matRef.current;
    if (mat?.map) {
      mat.map.offset.x = Math.sin(t * 0.05) * 0.3;
      mat.map.offset.y = t * 0.02;
      const pulse = 0.85 + Math.sin(t * 2.1) * 0.08 + level * 0.25;
      mat.color.setRGB(pulse, pulse, pulse);
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.9 + level * 0.85, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 6]}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial ref={matRef} map={tex} toneMapped={false} />
      </mesh>
      <Glow p={[0, 0.3, HD + 1.5]} size={8} color={PAL.ember} opacity={0.22} />
    </group>
  );
}

// ------------------------------------------------------------------ walls + decor

function RoomWalls({ theme, accent, floorNumber, isBoss, seed }: { theme: Theme; accent: string; floorNumber: number; isBoss: boolean; seed: number }) {
  const wall = std(theme.wall, { r: 0.9 });
  const trim = std(theme.trim);
  const glowStrip = basic(accent, { t: 0.9 });
  const plaqueColor = isBoss ? PAL.gold : accent;
  const plaque = labelTexture(String(floorNumber), {
    color: plaqueColor,
    glow: plaqueColor,
    bg: "#12081c",
    border: plaqueColor,
    w: 256,
    h: 160,
    size: 0.7,
  });
  const storm = stormTexture();
  const posters = useMemo(() => {
    const r = rng(seed ^ 0xa11);
    const colors = [PAL.ember, PAL.gold, PAL.giving, PAL.receiving, PAL.good, "#ff4d6d"];
    return [-1, 1].flatMap((side) =>
      [6.6, -5.2].map((z) => ({ side, z, color: colors[Math.floor(r() * colors.length)], h: 0.9 + r() * 0.5 })),
    );
  }, [seed]);

  return (
    <group>
      {/* back wall with a storm window on the left */}
      <Bx p={[3, WALL_H / 2, -HD - 0.2]} s={[8.4, WALL_H, 0.4]} m={wall} />
      <Bx p={[-5.6, WALL_H / 2, -HD - 0.2]} s={[3.2, WALL_H, 0.4]} m={wall} />
      <Bx p={[-2.6, 0.6, -HD - 0.2]} s={[2.8, 1.2, 0.4]} m={wall} />
      <Bx p={[-2.6, 4.6, -HD - 0.2]} s={[2.8, 0.8, 0.4]} m={wall} />
      <Pl p={[-2.6, 2.6, -HD - 0.35]} s={[2.8, 2.8, 1]} m={basic("#ffffff", { map: storm, fog: false })} />
      <Bx p={[-2.6, 2.6, -HD - 0.1]} s={[0.08, 2.8, 0.1]} m={trim} />
      <Bx p={[-2.6, 2.6, -HD - 0.1]} s={[2.8, 0.08, 0.1]} m={trim} />
      {/* side walls */}
      <Bx p={[-HW - 0.2, WALL_H / 2, 0]} s={[0.4, WALL_H, HD * 2 + 0.4]} m={wall} />
      <Bx p={[HW + 0.2, WALL_H / 2, 0]} s={[0.4, WALL_H, HD * 2 + 0.4]} m={wall} />
      {/* front corner posts to frame the room */}
      <Bx p={[-HW - 0.1, WALL_H / 2, HD]} s={[0.7, WALL_H, 0.7]} m={trim} />
      <Bx p={[HW + 0.1, WALL_H / 2, HD]} s={[0.7, WALL_H, 0.7]} m={trim} />
      {/* top cornice + mode-colored light strips */}
      <Bx p={[-HW + 0.05, WALL_H - 0.15, 0]} s={[0.3, 0.3, HD * 2]} m={trim} />
      <Bx p={[HW - 0.05, WALL_H - 0.15, 0]} s={[0.3, 0.3, HD * 2]} m={trim} />
      <Bx p={[0, WALL_H - 0.15, -HD + 0.05]} s={[HW * 2, 0.3, 0.3]} m={trim} />
      <Bx p={[-HW + 0.03, 0.06, 0]} s={[0.04, 0.06, HD * 2]} m={glowStrip} />
      <Bx p={[HW - 0.03, 0.06, 0]} s={[0.04, 0.06, HD * 2]} m={glowStrip} />
      <Bx p={[0, 0.06, -HD + 0.03]} s={[HW * 2, 0.06, 0.04]} m={glowStrip} />
      <Bx p={[-HW + 0.22, WALL_H - 0.36, 0]} s={[0.04, 0.05, HD * 2]} m={glowStrip} />
      <Bx p={[HW - 0.22, WALL_H - 0.36, 0]} s={[0.04, 0.05, HD * 2]} m={glowStrip} />
      {/* floor number plaque above the sensei */}
      <Bx p={[0, 4.05, -HD + 0.02]} s={[1.6, 1, 0.08]} m={std("#12081c")} />
      <Pl p={[0, 4.05, -HD + 0.08]} s={[1.5, 0.94, 1]} m={basic("#ffffff", { map: plaque })} />
      <Glow p={[0, 4.05, -HD + 0.4]} size={2.4} color={plaqueColor} opacity={0.35} />
      {/* framed posters (pure color, no text) */}
      {!isBoss &&
        posters.map((p) => (
          <group key={`${p.side},${p.z}`} position={[p.side * (HW - 0.02), 2.6, p.z]} rotation={[0, -p.side * (Math.PI / 2), 0]}>
            <Bx p={[0, 0, 0]} s={[1.1, p.h + 0.15, 0.05]} m={trim} />
            <Pl p={[0, 0, 0.03]} s={[0.95, p.h, 1]} m={std(p.color, { e: p.color, ei: 0.25 })} />
            <Pl p={[0, -p.h * 0.18, 0.035]} s={[0.6, 0.06, 1]} m={basic("#f4eeff", { t: 0.6 })} />
          </group>
        ))}
    </group>
  );
}

function CeilingLights() {
  // Only the front row has fixtures: rear slabs would sit between the follow camera and the
  // back wall (sensei, stairs, villain, sign). The back half keeps soft light pools instead.
  const rows: Array<[number, number]> = [
    [-2.6, 4],
    [2.6, 4],
  ];
  const pool = basic("#c9d6ff", { t: 0.14, add: true, map: glowTexture() });
  return (
    <group>
      {[-2.6, 2.6].map((x) => (
        <mesh key={`pool${x}`} position={[x, 0.02, -2]} scale={[2.2, 1, 3.6]} geometry={G.disc(16)} material={pool} />
      ))}
      {rows.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 4.55, z]}>
          <Bx p={[0, 0, 0]} s={[0.5, 0.08, 2.4]} m={std("#3a3550")} />
          <Bx p={[0, -0.05, 0]} s={[0.36, 0.04, 2.2]} m={basic("#e6f0ff")} />
          <Cy p={[0, 0.3, -0.9]} s={[0.02, 0.6, 0.02]} segs={4} m={basic("#0e0718")} />
          <Cy p={[0, 0.3, 0.9]} s={[0.02, 0.6, 0.02]} segs={4} m={basic("#0e0718")} />
          <mesh position={[0, -4.53, 0]} scale={[2.2, 1, 3.6]} geometry={G.disc(16)} material={pool} />
        </group>
      ))}
    </group>
  );
}

/**
 * Soft glowing circle where the sensei stands, plus a faint path from the spawn. Once the stairs
 * open, the disc dims and the path goes away so the gold stairs path is the only trail.
 */
function SenseiSpot({ accent, stairsOpen }: { accent: string; stairsOpen: boolean }) {
  const len = PLAYER_SPAWN[1] - SENSEI_POS[1] - 1.6;
  return (
    <group>
      <mesh position={[SENSEI_POS[0], 0.012, SENSEI_POS[1]]} scale={[3.4, 1, 3.4]} geometry={G.disc(32)} material={basic(accent, { t: stairsOpen ? 0.08 : 0.22, add: true, map: glowTexture() })} />
      {!stairsOpen && Array.from({ length: 6 }, (_, i) => {
        const z = PLAYER_SPAWN[1] - 0.8 - (i * len) / 5;
        return (
          <mesh
            key={i}
            position={[0, 0.011, z]}
            scale={[0.35, 1, 0.35]}
            geometry={G.disc(12)}
            material={basic(accent, { t: Math.min(1, (0.18 + i * 0.03) * 2), add: true, map: glowTexture() })}
          />
        );
      })}
    </group>
  );
}

// ------------------------------------------------------------------ office props

type PropKind = "desk" | "cabinets" | "cooler" | "board" | "copier" | "papers";

const SLOT_Z = [4.3, 1.0, -2.3];

function OfficeProps({ theme, seed }: { theme: Theme; seed: number }) {
  const layout = useMemo(() => {
    const r = rng(seed);
    const pool: PropKind[] = ["desk", "desk", "cabinets", "cooler", "board", "copier", "papers", "desk"];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const kinds = pool.slice(0, 6);
    if (!kinds.includes("desk")) kinds[0] = "desk";
    return kinds.map((kind, i) => ({
      kind,
      side: i < 3 ? -1 : 1,
      z: SLOT_Z[i % 3],
      seed: Math.floor(r() * 1e6),
    }));
  }, [seed]);

  return (
    <group>
      {layout.map((s) => (
        <group key={`${s.side},${s.z}`} position={[s.side * (ROOM_BAND_X + 0.2), 0, s.z]} rotation={[0, s.side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <PropSlot kind={s.kind} theme={theme} seed={s.seed} />
        </group>
      ))}
    </group>
  );
}

function PropSlot({ kind, theme, seed }: { kind: PropKind; theme: Theme; seed: number }) {
  switch (kind) {
    case "desk":
      return <DeskCluster theme={theme} seed={seed} />;
    case "cabinets":
      return <Cabinets theme={theme} />;
    case "cooler":
      return <CoolerCorner theme={theme} />;
    case "board":
      return <Whiteboard theme={theme} seed={seed} />;
    case "copier":
      return <Copier theme={theme} />;
    default:
      return <PaperPile seed={seed} />;
  }
}

function PaperStack({ p, n, seed }: { p: [number, number, number]; n: number; seed: number }) {
  const r = rng(seed);
  const paper = std("#ece6f6", { r: 1 });
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => (
        <Bx key={i} p={[(r() - 0.5) * 0.04, 0.05 + i * 0.1, (r() - 0.5) * 0.04]} s={[0.32, 0.1, 0.42]} r={[0, (r() - 0.5) * 0.35, 0]} m={paper} />
      ))}
    </group>
  );
}

function DeskCluster({ theme, seed }: { theme: Theme; seed: number }) {
  const wood = std(theme.wood, { r: 0.7 });
  const dark = std("#120a1e");
  const metal = std(theme.metal, { m: 0.4 });
  const screen = basic(theme.screen, { t: 0.85 });
  const seat = std(theme.trim);
  return (
    <group>
      <BlobShadow size={2.6} opacity={0.35} />
      {/* desk */}
      <Bx p={[0, 0.76, -0.15]} s={[2.1, 0.08, 0.95]} m={wood} />
      <Bx p={[-0.98, 0.37, -0.15]} s={[0.08, 0.74, 0.85]} m={metal} />
      <Bx p={[0.98, 0.37, -0.15]} s={[0.08, 0.74, 0.85]} m={metal} />
      <Bx p={[0, 0.5, -0.55]} s={[1.9, 0.4, 0.04]} m={metal} />
      {/* monitor */}
      <Bx p={[-0.2, 1.17, -0.42]} s={[0.78, 0.48, 0.05]} m={dark} />
      <Pl p={[-0.2, 1.17, -0.39]} s={[0.7, 0.4, 1]} m={screen} />
      <Cy p={[-0.2, 0.88, -0.45]} s={[0.06, 0.18, 0.06]} m={dark} />
      <Bx p={[-0.2, 0.81, -0.45]} s={[0.3, 0.02, 0.18]} m={dark} />
      <Glow p={[-0.2, 1.17, -0.2]} size={1.2} color={theme.screen} opacity={0.35} />
      {/* keyboard + mug + papers */}
      <Bx p={[-0.2, 0.81, -0.05]} s={[0.55, 0.03, 0.18]} m={std("#2a2440")} />
      <Cy p={[0.55, 0.86, -0.1]} s={[0.12, 0.14, 0.12]} m={std(PAL.ember2)} />
      <PaperStack p={[0.7, 0.8, -0.4]} n={3} seed={seed} />
      {/* chair */}
      <group position={[-0.15, 0, 0.55]}>
        <Bx p={[0, 0.5, 0]} s={[0.55, 0.08, 0.5]} m={seat} />
        <Bx p={[0, 0.85, 0.24]} s={[0.55, 0.6, 0.07]} m={seat} />
        <Cy p={[0, 0.25, 0]} s={[0.06, 0.45, 0.06]} m={dark} />
        <Bx p={[0, 0.04, 0]} s={[0.5, 0.04, 0.08]} m={dark} />
        <Bx p={[0, 0.04, 0]} s={[0.08, 0.04, 0.5]} m={dark} />
      </group>
    </group>
  );
}

function Cabinets({ theme }: { theme: Theme }) {
  const metal = std(theme.metal, { m: 0.45, r: 0.5 });
  const line = std("#120a1e");
  const handle = std(PAL.gold, { m: 0.8, r: 0.3 });
  return (
    <group>
      <BlobShadow size={2.4} opacity={0.35} />
      {[-0.42, 0.42].map((x, k) => (
        <group key={x} position={[x, 0, -0.3]}>
          <Bx p={[0, 0.68 + k * 0.1, 0]} s={[0.76, 1.36 + k * 0.2, 0.66]} m={metal} />
          {[0.3, 0.72, 1.14].map((y) => (
            <group key={y}>
              <Bx p={[0, y + k * 0.05, 0.335]} s={[0.66, 0.02, 0.02]} m={line} />
              <Bx p={[0, y + 0.18 + k * 0.05, 0.345]} s={[0.2, 0.04, 0.04]} m={handle} />
            </group>
          ))}
        </group>
      ))}
      {/* cardboard box + small plant on top */}
      <Bx p={[-0.42, 1.52, -0.3]} s={[0.55, 0.32, 0.45]} r={[0, 0.2, 0]} m={std("#8a6a45")} />
      <Cy p={[0.42, 1.62, -0.3]} s={[0.25, 0.2, 0.25]} m={std(theme.trim)} />
      <Cn p={[0.42, 1.92, -0.3]} s={[0.35, 0.45, 0.35]} segs={5} m={std("#3ddc97")} />
    </group>
  );
}

function CoolerCorner({ theme }: { theme: Theme }) {
  return (
    <group>
      <BlobShadow size={2.4} opacity={0.35} />
      {/* water cooler */}
      <group position={[-0.5, 0, -0.3]}>
        <Bx p={[0, 0.5, 0]} s={[0.45, 1, 0.45]} m={std("#dfe6f2")} />
        <Bx p={[0, 0.72, 0.23]} s={[0.12, 0.06, 0.06]} m={std(PAL.giving)} />
        <Cy p={[0, 1.25, 0]} s={[0.36, 0.5, 0.36]} segs={10} m={std("#7fd6ff", { t: 0.6, smooth: true, r: 0.2 })} />
        <Cy p={[0, 1.52, 0]} s={[0.14, 0.06, 0.14]} m={std("#7fd6ff", { t: 0.6 })} />
      </group>
      {/* potted plant */}
      <group position={[0.45, 0, -0.25]}>
        <Tp p={[0, 0.25, 0]} s={[1, 0.5, 1]} top={0.3} bottom={0.22} m={std(theme.trim)} />
        <Cn p={[0, 0.85, 0]} s={[0.6, 0.9, 0.6]} segs={5} m={std("#2f8a5c")} />
        <Cn p={[0.1, 1.2, 0.05]} s={[0.4, 0.7, 0.4]} r={[0.2, 0, -0.2]} segs={5} m={std("#3ddc97")} />
      </group>
      {/* bin */}
      <Tp p={[0.05, 0.18, 0.35]} s={[1, 0.36, 1]} top={0.17} bottom={0.13} m={std("#2a2440")} />
    </group>
  );
}

function Whiteboard({ theme, seed }: { theme: Theme; seed: number }) {
  const r = rng(seed);
  const marks = [PAL.bad, PAL.giving, PAL.good, theme.accent];
  const bars = Array.from({ length: 4 }, () => 0.15 + r() * 0.45);
  const lines = Array.from({ length: 4 }, () => ({ w: 0.3 + r() * 0.5, c: marks[Math.floor(r() * marks.length)] }));
  const frame = std(theme.metal, { m: 0.5 });
  return (
    <group position={[0, 0, -0.3]}>
      <BlobShadow size={2.2} opacity={0.3} />
      <Bx p={[-0.85, 0.85, 0]} s={[0.06, 1.7, 0.06]} m={frame} />
      <Bx p={[0.85, 0.85, 0]} s={[0.06, 1.7, 0.06]} m={frame} />
      <Bx p={[0, 1.4, 0]} s={[1.85, 1.1, 0.06]} m={frame} />
      <Pl p={[0, 1.4, 0.035]} s={[1.75, 1, 1]} m={std("#f2f0fa", { e: "#ffffff", ei: 0.12, r: 0.4 })} />
      {/* scribbles: lines on the left, a bar chart on the right */}
      {lines.map((l, i) => (
        <Pl key={i} p={[-0.75 + l.w / 2, 1.72 - i * 0.16, 0.04]} s={[l.w, 0.035, 1]} m={basic(l.c)} />
      ))}
      {bars.map((h, i) => (
        <Pl key={i} p={[0.25 + i * 0.16, 1.02 + h / 2, 0.04]} s={[0.1, h, 1]} m={basic(marks[i % marks.length])} />
      ))}
      <Bx p={[0, 0.84, 0.08]} s={[1.7, 0.04, 0.1]} m={frame} />
    </group>
  );
}

function Copier({ theme }: { theme: Theme }) {
  return (
    <group position={[0, 0, -0.25]}>
      <BlobShadow size={2.4} opacity={0.35} />
      <Bx p={[0, 0.5, 0]} s={[1.1, 1, 0.75]} m={std("#d9d4e6")} />
      <Bx p={[0, 1.06, -0.05]} s={[1.1, 0.12, 0.65]} m={std("#4a4366")} />
      <Bx p={[0.62, 0.78, 0]} s={[0.2, 0.04, 0.45]} m={std("#ece6f6")} />
      <Bx p={[-0.3, 1.0, 0.38]} s={[0.3, 0.1, 0.04]} m={std("#2a2440")} />
      <Bl p={[-0.38, 1.0, 0.41]} s={0.05} m={basic(PAL.good)} />
      <Bl p={[-0.25, 1.0, 0.41]} s={0.05} m={basic(PAL.ember)} />
      <Bx p={[0, 0.25, 0.38]} s={[0.9, 0.04, 0.02]} m={std(theme.metal)} />
      <PaperStack p={[-0.95, 0, 0.1]} n={5} seed={11} />
    </group>
  );
}

function PaperPile({ seed }: { seed: number }) {
  return (
    <group>
      <BlobShadow size={2.4} opacity={0.3} />
      <PaperStack p={[-0.6, 0, -0.3]} n={7} seed={seed} />
      <PaperStack p={[-0.15, 0, -0.35]} n={4} seed={seed + 1} />
      <PaperStack p={[0.3, 0, -0.25]} n={9} seed={seed + 2} />
      <Bx p={[0.75, 0.22, -0.3]} s={[0.55, 0.44, 0.5]} r={[0, 0.3, 0]} m={std("#8a6a45")} />
      <Bx p={[0.75, 0.6, -0.3]} s={[0.45, 0.32, 0.4]} r={[0, -0.1, 0]} m={std("#9c7a52")} />
    </group>
  );
}

// ------------------------------------------------------------------ boss dojo / boardroom

function BossProps() {
  const table = std("#3a1a14", { r: 0.45, m: 0.15 });
  const tableTop = std("#5a2a1c", { r: 0.3, m: 0.2 });
  const chair = std("#22101c");
  const gold = std(PAL.gold, { m: 0.8, r: 0.3, e: PAL.gold, ei: 0.15 });
  const chairZ = [-1.2, 0, 1.2, 2.4];
  return (
    <group>
      {/* red carpet with gold trim to the Grand Sensei */}
      <Pl p={[0, 0.008, 1.4]} r={[-Math.PI / 2, 0, 0]} s={[2.2, 14.4, 1]} m={std("#8a1424", { r: 1 })} />
      <Pl p={[-1.12, 0.01, 1.4]} r={[-Math.PI / 2, 0, 0]} s={[0.08, 14.4, 1]} m={basic(PAL.gold, { t: 0.8 })} />
      <Pl p={[1.12, 0.01, 1.4]} r={[-Math.PI / 2, 0, 0]} s={[0.08, 14.4, 1]} m={basic(PAL.gold, { t: 0.8 })} />

      {/* long boardroom tables down both sides */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (ROOM_BAND_X + 0.15), 0, 1]}>
          <BlobShadow size={2.4} opacity={0.4} />
          <Bx p={[0, 0.78, 0]} s={[1.3, 0.1, 5.8]} m={tableTop} />
          <Bx p={[0, 0.38, -2.5]} s={[1.0, 0.76, 0.12]} m={table} />
          <Bx p={[0, 0.38, 2.5]} s={[1.0, 0.76, 0.12]} m={table} />
          <Bx p={[0, 0.38, 0]} s={[0.12, 0.76, 4.8]} m={table} />
          {chairZ.map((z) => (
            <group key={z} position={[-side * 0.95, 0, z]}>
              <Bx p={[0, 0.48, 0]} s={[0.5, 0.08, 0.5]} m={chair} />
              <Bx p={[-side * 0.24, 0.95, 0]} s={[0.08, 0.95, 0.52]} m={chair} />
              <Bx p={[-side * 0.24, 1.44, 0]} s={[0.1, 0.06, 0.56]} m={gold} />
              <Cy p={[0, 0.24, 0]} s={[0.06, 0.48, 0.06]} m={chair} />
            </group>
          ))}
          <Bl p={[0, 0.9, -1.6]} s={[0.2, 0.14, 0.2]} m={gold} />
          <Bl p={[0, 0.9, 1.8]} s={[0.2, 0.14, 0.2]} m={gold} />
        </group>
      ))}

      {/* ember braziers at the band ends */}
      {[-1, 1].flatMap((side) =>
        [5.0, -3.0].map((z) => <Brazier key={`${side},${z}`} p={[side * (ROOM_BAND_X + 0.1), 0, z]} phase={side * 3 + z} />),
      )}

      {/* banners on the side walls */}
      {[-1, 1].flatMap((side) =>
        [-1.2, 3.4].map((z) => (
          <group key={`${side},${z}`} position={[side * (HW - 0.06), 2.9, z]} rotation={[0, -side * (Math.PI / 2), 0]}>
            <Bx p={[0, 1.45, 0.04]} s={[1.3, 0.08, 0.08]} m={gold} />
            <Pl p={[0, 0, 0.06]} s={[1.1, 2.8, 1]} m={std(z > 0 ? "#7a1424" : "#4a1a6a", { side: THREE.DoubleSide })} />
            <mesh position={[0, 0.25, 0.07]} scale={[0.75, 1, 0.75]} rotation={[Math.PI / 2, 0, 0]} geometry={G.ring(0.6, 6)} material={basic(PAL.gold)} />
            <Cn p={[0, -1.55, 0.06]} s={[1.1, 0.4, 0.05]} r={[Math.PI, 0, 0]} segs={3} m={std(z > 0 ? "#7a1424" : "#4a1a6a")} />
          </group>
        )),
      )}

      {/* tapestry behind the Grand Sensei */}
      <group position={[0, 2.5, -HD + 0.06]}>
        <Pl p={[0, 0, 0]} s={[3.6, 3.4, 1]} m={std("#3a0d18", { side: THREE.DoubleSide })} />
        <mesh position={[0, 0.2, 0.02]} scale={[1.8, 1, 1.8]} rotation={[Math.PI / 2, 0, 0]} geometry={G.ring(0.8, 32)} material={basic(PAL.gold)} />
        <Bl p={[0, 0.2, 0.03]} s={[0.9, 0.42, 0.02]} m={basic(PAL.ember)} />
        <Bx p={[0, 0.2, 0.05]} s={[0.1, 0.36, 0.02]} m={basic("#12060a")} />
        <Bx p={[0, 1.75, 0.04]} s={[3.9, 0.1, 0.1]} m={gold} />
      </group>
      {/* dais */}
      <Cy p={[SENSEI_POS[0], 0.06, SENSEI_POS[1]]} s={[3.6, 0.12, 3.6]} segs={12} m={std("#3a1a24", { r: 0.5 })} />
      <Cy p={[SENSEI_POS[0], 0.125, SENSEI_POS[1]]} s={[3.62, 0.015, 3.62]} segs={12} m={basic(PAL.gold, { t: 0.8 })} />
    </group>
  );
}

function Brazier({ p, phase }: { p: [number, number, number]; phase: number }) {
  const flameRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const f = flameRef.current;
    if (!f) return;
    const t = state.clock.elapsedTime + phase;
    const s = 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
    f.scale.set(1, s, 1);
    f.rotation.y = t * 0.8;
  });
  const iron = std("#1a1016", { m: 0.6, r: 0.5 });
  return (
    <group position={p}>
      <BlobShadow size={1.2} opacity={0.4} />
      <Tp p={[0, 0.45, 0]} s={[1, 0.9, 1]} top={0.08} bottom={0.22} segs={6} m={iron} />
      <Tp p={[0, 1.0, 0]} s={[1, 0.25, 1]} top={0.42} bottom={0.22} segs={8} m={iron} />
      <group ref={flameRef} position={[0, 1.1, 0]}>
        <Cn p={[0, 0.35, 0]} s={[0.55, 0.75, 0.55]} segs={5} m={basic(PAL.ember)} />
        <Cn p={[0.05, 0.3, 0.03]} s={[0.32, 0.55, 0.32]} segs={5} m={basic(PAL.gold)} />
      </group>
      <Glow p={[0, 1.5, 0]} size={2.4} color={PAL.ember} opacity={0.65} />
    </group>
  );
}

// ------------------------------------------------------------------ stairs to the next floor

const SPARK_COUNT = 36;

function Stairs({ open }: { open: boolean }) {
  const [sx, sz] = STAIRS_POS;
  const doorMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const gateRef = useRef<THREE.Group>(null);
  const arrowRef = useRef<THREE.Group>(null);
  const sparksRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const amount = useRef(open ? 1 : 0);

  const sparkSeeds = useMemo(() => {
    const r = rng(99);
    const arr = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) {
      arr[i * 3] = (r() - 0.5) * 1.8;
      arr[i * 3 + 1] = r() * 3;
      arr[i * 3 + 2] = (r() - 0.5) * 1.2;
    }
    return arr;
  }, []);

  const closedColor = useMemo(() => new THREE.Color("#2a1840"), []);
  const openColor = useMemo(() => new THREE.Color("#ffd36a"), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    amount.current += ((open ? 1 : 0) - amount.current) * (1 - Math.exp(-3 * step));
    const a = amount.current;
    if (doorMat.current) doorMat.current.color.copy(closedColor).lerp(openColor, a);
    if (ringMat.current) ringMat.current.opacity = a * (0.35 + 0.25 * Math.sin(t * 4));
    if (gateRef.current) gateRef.current.position.y = a * 3.1;
    if (glowRef.current) {
      const s = 1.5 + a * 4.5;
      glowRef.current.scale.set(s, s, 1);
      glowRef.current.material.opacity = 0.15 + a * 0.6;
    }
    if (arrowRef.current) {
      arrowRef.current.visible = a > 0.05;
      arrowRef.current.position.y = 2.2 + Math.sin(t * 3) * 0.15;
      arrowRef.current.scale.setScalar(Math.max(0.01, a));
    }
    const pts = sparksRef.current;
    if (pts) {
      pts.visible = a > 0.05;
      if (pts.visible) {
        const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < SPARK_COUNT; i++) {
          let y = arr[i * 3 + 1] + step * (0.6 + (i % 5) * 0.15);
          if (y > 3.2) y = 0;
          arr[i * 3 + 1] = y;
        }
        attr.needsUpdate = true;
      }
    }
  });

  const stone = std("#4a3a66", { r: 0.7 });
  const frame = std("#1a1028", { m: 0.4 });
  const bars = std("#3a2f4f", { m: 0.7, r: 0.4 });
  const backZ = -HD;

  return (
    <group>
      {/* target ring on the floor */}
      <mesh position={[sx, 0.015, sz]} scale={[3.2, 1, 3.2]} geometry={G.ring(0.4, 40)}>
        <meshBasicMaterial ref={ringMat} color={PAL.gold} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* steps rising into the doorway */}
      {[0, 1, 2, 3].map((i) => (
        <Bx key={i} p={[sx, 0.11 + i * 0.11, sz - 0.1 - i * 0.32]} s={[2.0, 0.22 + i * 0.22, 0.34]} m={stone} />
      ))}
      <Bx p={[sx, 0.5, backZ + 0.35]} s={[2.0, 1.0, 0.5]} m={stone} />
      {/* doorway frame */}
      <Bx p={[sx - 1.15, 1.8, backZ + 0.1]} s={[0.3, 3.6, 0.4]} m={frame} />
      <Bx p={[sx + 1.15, 1.8, backZ + 0.1]} s={[0.3, 3.6, 0.4]} m={frame} />
      <Bx p={[sx, 3.55, backZ + 0.1]} s={[2.6, 0.3, 0.4]} m={frame} />
      <Bx p={[sx, 3.75, backZ + 0.12]} s={[2.7, 0.08, 0.3]} m={basic(PAL.gold, { t: 0.9 })} />
      {/* light inside the doorway */}
      <mesh position={[sx, 2.2, backZ + 0.02]} scale={[2.0, 2.7, 1]} geometry={G.plane()}>
        <meshBasicMaterial ref={doorMat} color="#2a1840" toneMapped={false} />
      </mesh>
      <sprite ref={glowRef} position={[sx, 2.2, backZ + 0.6]} scale={[1.5, 1.5, 1]}>
        <spriteMaterial
          map={glowTexture()}
          color={PAL.gold}
          transparent
          opacity={0.15}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          attach="material"
        />
      </sprite>
      {/* iron gate that lifts when the stairs open */}
      <group ref={gateRef}>
        {[-0.75, -0.375, 0, 0.375, 0.75].map((dx) => (
          <Bx key={dx} p={[sx + dx, 1.85, backZ + 0.3]} s={[0.07, 3.3, 0.07]} m={bars} />
        ))}
        <Bx p={[sx, 1.2, backZ + 0.3]} s={[1.7, 0.08, 0.08]} m={bars} />
        <Bx p={[sx, 2.6, backZ + 0.3]} s={[1.7, 0.08, 0.08]} m={bars} />
      </group>
      {/* floating up-chevron */}
      <group ref={arrowRef} position={[sx, 2.2, sz + 0.2]} visible={open}>
        <Bx p={[-0.17, 0, 0]} s={[0.5, 0.13, 0.13]} r={[0, 0, Math.PI / 4]} m={basic(PAL.gold)} />
        <Bx p={[0.17, 0, 0]} s={[0.5, 0.13, 0.13]} r={[0, 0, -Math.PI / 4]} m={basic(PAL.gold)} />
      </group>
      {/* rising sparks */}
      <points ref={sparksRef} position={[sx, 0.2, sz - 0.6]} visible={open} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkSeeds, 3]} />
        </bufferGeometry>
        <pointsMaterial color={PAL.gold} size={0.09} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}
