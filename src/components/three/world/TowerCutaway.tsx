"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { HeroModel, usePrefersReducedMotion } from "@/components/three/kit";
import { getHero } from "@/lib/characters";
import type { PlayerPhase } from "@/lib/types";
import { DoomEye } from "./DoomEye";
import { Bl, Bx, Cn, Cy, Glow, Pl } from "./prims";
import { PAL, basic, emojiTexture, labelTexture, lavaTexture, rng, spriteMat, std } from "./shared";

export interface CutawayPlayer {
  playerId: string;
  heroId: string;
  name: string;
  /** 0 = lobby / ground, 1..12 = floor being fought */
  floor: number;
  phase: PlayerPhase;
  outcome?: "victory" | "doomed";
}

export interface TowerCutawayProps {
  players: CutawayPlayer[];
  /** Total height of the 12 floors + roof in world units (default 26). */
  height?: number;
}

const FLOORS = 12;
const BOSS = new Set([6, 12]);
const W_MIN = 14; // tower width (fits the narrowest frame)
const W_MAX = 24; // widest the tower grows on wide projector screens
const D = 4.2; // tower depth
const DEFAULT_HEIGHT = 26;

/** Heroes per row on one floor: more on a wider tower. */
function maxPerRow(w: number): number {
  return Math.max(9, Math.min(16, Math.floor((w - 2) / 1.4)));
}

/** Tower width that fills the frame horizontally (the zoom itself is fitted to the height). */
export function towerWidth(size: { width: number }, zoom: number): number {
  return Math.min(W_MAX, Math.max(W_MIN, size.width / zoom - 6));
}

function floorH(height: number): number {
  return height / (FLOORS + 1);
}

/** World-space extents the cutaway occupies (for camera framing). */
function extents(height: number) {
  const fh = floorH(height);
  const top = (FLOORS + 1) * fh + 3.4; // roof + doom eye
  const bottom = -1.0; // top of the lava
  return { top, bottom, cy: (top + bottom) / 2, span: top - bottom, width: W_MIN + 6 };
}

/** Ortho zoom (pixels per world unit) that fits the whole tower in the viewport. */
export function cutawayZoom(size: { width: number; height: number }, height = DEFAULT_HEIGHT): number {
  const e = extents(height);
  return Math.max(4, Math.min(size.height / (e.span + 0.4), size.width / e.width));
}

/**
 * Fixed orthographic camera framing the whole cutaway (slight 3/4 angle so the floor slabs
 * read in depth). Also disables scene fog while mounted so the projector view stays crisp.
 */
export function TowerCutawayCamera({ height = DEFAULT_HEIGHT }: { height?: number }) {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  const { cy } = extents(height);
  const zoom = cutawayZoom(size, height);

  useLayoutEffect(() => {
    const cam = camRef.current;
    if (!cam) return;
    cam.lookAt(0, cy, 0);
    cam.updateProjectionMatrix();
  }, [cy, zoom, size.width, size.height]);

  useEffect(() => {
    const scene = get().scene;
    const prev = scene.fog;
    scene.fog = null;
    return () => {
      scene.fog = prev;
    };
  }, [get]);

  return <OrthographicCamera ref={camRef} makeDefault position={[7, cy + 5, 40]} zoom={zoom} near={0.1} far={200} />;
}

/** Side cross-section of the 12-floor tower with every player's hero standing on their floor. */
export function TowerCutaway({ players, height = DEFAULT_HEIGHT }: TowerCutawayProps) {
  const fh = floorH(height);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const isOrtho = (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
  const zoom = cutawayZoom(size, height);
  // drei <Html distanceFactor> scales by camera.zoom on ortho cameras; normalize so labels stay ~1x
  // (bigger labels cover the whole hero: a floor is only ~2 units tall).
  const distanceFactor = isOrtho ? 1 / zoom : 18;
  const w = towerWidth(size, zoom);

  const placed = useMemo(() => layoutPlayers(players, fh, w), [players, fh, w]);
  const anyVictor = placed.some((p) => p.victor);

  return (
    <group>
      <hemisphereLight args={["#9a86d8", "#1a0d24", 1.1]} />
      <ambientLight intensity={0.35} color="#c9b8f0" />
      <directionalLight position={[8, 20, 20]} intensity={1.2} color="#ffd9bf" />
      <directionalLight position={[-10, 5, 10]} intensity={0.5} color="#8fa6ff" />

      <TowerShell fh={fh} victory={anyVictor} w={w} />
      <BaseLava w={w} />

      {placed.map((p) => (
        <Token key={p.player.playerId} p={p} distanceFactor={distanceFactor} />
      ))}
    </group>
  );
}

// ------------------------------------------------------------------ layout

interface Placed {
  player: CutawayPlayer;
  level: number; // 0..13 (13 = roof)
  target: [number, number, number];
  scale: number;
  showName: boolean;
  victor: boolean;
  doomed: boolean;
}

function levelOf(p: CutawayPlayer): number {
  if (p.outcome === "victory") return FLOORS + 1;
  const f = Number.isFinite(p.floor) ? Math.round(p.floor) : 0;
  if (p.phase === "lobby") return 0;
  if (p.phase === "playing") return Math.min(FLOORS, Math.max(1, f));
  return Math.min(FLOORS, Math.max(0, f));
}

function layoutPlayers(players: CutawayPlayer[], fh: number, w: number): Placed[] {
  const byLevel = new Map<number, CutawayPlayer[]>();
  for (const p of players) {
    const lvl = levelOf(p);
    const list = byLevel.get(lvl) ?? [];
    list.push(p);
    byLevel.set(lvl, list);
  }
  const out: Placed[] = [];
  const baseScale = fh * 0.5;
  const rowMax = maxPerRow(w);
  for (const [level, list] of byLevel) {
    list.sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
    const n = list.length;
    const crowded = n > rowMax;
    const scale = crowded ? baseScale * 0.82 : baseScale;
    const perRow = Math.min(n, rowMax);
    const spacing = Math.min(1.35, (w - 2) / Math.max(1, perRow));
    list.forEach((player, i) => {
      const row = Math.floor(i / rowMax);
      const col = i % rowMax;
      const inRow = Math.min(rowMax, n - row * rowMax);
      const x = (col - (inRow - 1) / 2) * spacing;
      const z = 1.0 - (row % 3) * 0.9;
      out.push({
        player,
        level,
        target: [x, level * fh, z],
        scale,
        showName: n <= 3,
        victor: player.outcome === "victory",
        doomed: player.outcome === "doomed",
      });
    });
  }
  return out;
}

// ------------------------------------------------------------------ hero tokens

const greyCache = new Map<string, THREE.Material>();
function greyOf(m: THREE.Material): THREE.Material {
  let g = greyCache.get(m.uuid);
  if (!g) {
    const c = m.clone() as THREE.MeshStandardMaterial;
    if (c.color) {
      const l = c.color.r * 0.3 + c.color.g * 0.59 + c.color.b * 0.11;
      c.color.setRGB(l * 0.55 + 0.08, l * 0.55 + 0.08, l * 0.6 + 0.1);
    }
    if (c.emissive) c.emissive.setRGB(0, 0, 0);
    greyCache.set(m.uuid, c);
    g = c;
  }
  return g;
}

function Token({ p, distanceFactor }: { p: Placed; distanceFactor: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const heroRef = useRef<THREE.Group>(null);
  const crownRef = useRef<THREE.Group>(null);
  const [initial] = useState<[number, number, number]>(p.target);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const reduce = usePrefersReducedMotion();
  const { target, scale, doomed, victor } = p;
  const hero = getHero(p.player.heroId);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const k = 1 - Math.exp(-2.2 * Math.min(dt, 0.1));
    g.position.x += (target[0] - g.position.x) * k;
    g.position.y += (target[1] - g.position.y) * k;
    g.position.z += (target[2] - g.position.z) * k;
    const far = Math.abs(target[1] - g.position.y) + Math.abs(target[0] - g.position.x) > 0.06;
    if (far !== movingRef.current) {
      movingRef.current = far;
      setMoving(far);
    }
    if (crownRef.current && !reduce) {
      crownRef.current.rotation.y = state.clock.elapsedTime * 1.2;
      crownRef.current.position.y = scale * 3.3 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
    }
  });

  // Fallen heroes turn grey (materials swapped for greyed clones; restored if revived).
  useEffect(() => {
    const root = heroRef.current;
    if (!root || !doomed) return;
    const swapped: Array<[THREE.Mesh, THREE.Material]> = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      swapped.push([mesh, mesh.material]);
      mesh.material = greyOf(mesh.material);
    });
    return () => {
      for (const [mesh, orig] of swapped) mesh.material = orig;
    };
  }, [doomed]);

  return (
    <group ref={groupRef} position={initial}>
      <group position={doomed ? [scale * 0.8, scale * 0.28, 0] : [0, 0, 0]} rotation={doomed ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
        <HeroModel
          ref={heroRef}
          heroId={p.player.heroId}
          name={p.player.name}
          scale={scale}
          moving={moving && !doomed}
          showLabel={false}
        />
      </group>
      {/* Tag beside the hero (not over it): emoji disc, plus the name when the floor is not crowded. */}
      <Html
        position={[scale * 0.75, scale * 0.9, 0.3]}
        distanceFactor={distanceFactor}
        zIndexRange={[15, 0]}
        pointerEvents="none"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          aria-hidden
          style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 3, whiteSpace: "nowrap", transform: "translateY(-50%)" }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              lineHeight: 1,
              background: "#150c22",
              border: "2px solid " + hero.color,
              opacity: doomed ? 0.6 : 1,
            }}
          >
            {hero.emoji}
          </div>
          {p.showName && p.player.name ? (
            <div
              style={{
                maxWidth: 110,
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: "15px",
                padding: "0 6px",
                borderRadius: 999,
                color: "#f4eeff",
                background: "rgba(11,6,20,0.78)",
                border: "1px solid rgba(52,34,79,0.9)",
              }}
            >
              {p.player.name}
            </div>
          ) : null}
        </div>
      </Html>
      {victor && (
        <group ref={crownRef} position={[0, scale * 3.3, 0]}>
          <Crown size={scale * 0.9} />
        </group>
      )}
      {doomed && (
        <>
          <Pl p={[scale * 0.4, 0.02, 0]} r={[-Math.PI / 2, 0, 0]} s={[1.6, 0.8, 1]} m={basic(PAL.ember, { t: 0.7 })} />
          <Glow p={[0, scale * 0.4, 0]} size={scale * 2.6} color={PAL.ember} opacity={0.55} />
          <sprite position={[0, scale * 0.9, 0.3]} scale={[scale * 1.4, scale * 1.4, 1]} material={spriteMat(emojiTexture("💀"), { fog: false })} />
        </>
      )}
    </group>
  );
}

function Crown({ size }: { size: number }) {
  const gold = std(PAL.gold, { m: 0.8, r: 0.25, e: PAL.gold, ei: 0.35 });
  return (
    <group scale={size}>
      <Cy p={[0, 0, 0]} s={[0.7, 0.25, 0.7]} segs={10} m={gold} />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return <Cn key={i} p={[Math.sin(a) * 0.3, 0.25, Math.cos(a) * 0.3]} s={[0.16, 0.3, 0.16]} segs={4} m={gold} />;
      })}
      <Bl p={[0, 0.02, 0.35]} s={0.1} m={basic(PAL.bad)} />
      <Glow p={[0, 0.1, 0]} size={1.8} color={PAL.gold} opacity={0.6} />
    </group>
  );
}

// ------------------------------------------------------------------ tower

function TowerShell({ fh, victory, w }: { fh: number; victory: boolean; w: number }) {
  const slab = std("#3a2a5e", { r: 0.6 });
  const column = std("#2a1d47", { r: 0.7 });
  const roofY = (FLOORS + 1) * fh;
  const windows = useMemo(() => {
    const r = rng(12);
    return Array.from({ length: FLOORS + 1 }, (_, lvl) => [-0.32, 0, 0.32].map((k) => ({ x: k * w, lit: r() < 0.75, lvl }))).flat();
  }, [w]);

  return (
    <group>
      {/* floors (level 0 = lobby, 1..12, roof = 13) */}
      {Array.from({ length: FLOORS + 2 }, (_, lvl) => {
        const y = lvl * fh;
        const boss = BOSS.has(lvl);
        const roof = lvl === FLOORS + 1;
        return (
          <group key={lvl}>
            <Bx p={[0, y - 0.11, 0]} s={[w + 0.6, 0.22, D + 0.3]} m={roof ? std("#4a3870") : slab} />
            <Bx p={[0, y - 0.11, D / 2 + 0.16]} s={[w + 0.62, 0.06, 0.02]} m={basic(boss ? PAL.ember : lvl === 0 ? PAL.gold : "#6a55a8", { t: 0.9 })} />
            {!roof && <FloorBay lvl={lvl} y={y} fh={fh} boss={boss} w={w} />}
          </group>
        );
      })}
      {/* lit office windows on the back walls */}
      {windows.map((w, i) =>
        w.lvl >= 1 && w.lvl <= FLOORS ? (
          <Pl
            key={i}
            p={[w.x, w.lvl * fh + fh * 0.55, -D / 2 + 0.02]}
            s={[1.6, fh * 0.38, 1]}
            m={basic(BOSS.has(w.lvl) ? "#ff8a4a" : w.lit ? "#ffd9a0" : "#2a2050", { t: w.lit ? 0.32 : 0.6 })}
          />
        ) : null,
      )}
      {/* side columns */}
      <Bx p={[-w / 2 - 0.15, roofY / 2, 0]} s={[0.5, roofY, D + 0.4]} m={column} />
      <Bx p={[w / 2 + 0.15, roofY / 2, 0]} s={[0.5, roofY, D + 0.4]} m={column} />
      {/* roof spire + doom eye */}
      <Cn p={[-w / 2 + 1, roofY + 1.2, 0]} s={[0.6, 2.4, 0.6]} segs={4} m={column} />
      <Cn p={[w / 2 - 1, roofY + 1.2, 0]} s={[0.6, 2.4, 0.6]} segs={4} m={column} />
      <DoomEye position={[0, roofY + (victory ? 3.0 : 2.2), -0.6]} scale={victory ? 0.6 : 0.45} fog={false} />
      {victory && (
        <>
          <Glow p={[0, roofY + 1, 0.5]} size={16} color={PAL.gold} opacity={0.55} />
          <Pl p={[0, roofY + 6, -1]} s={[w * 0.7, 12, 1]} m={basic(PAL.gold, { t: 0.08, add: true })} />
        </>
      )}
    </group>
  );
}

function FloorBay({ lvl, y, fh, boss, w }: { lvl: number; y: number; fh: number; boss: boolean; w: number }) {
  const wallColor = lvl === 0 ? "#2a1d47" : boss ? "#3a1424" : lvl % 2 ? "#1f1636" : "#251a40";
  const plateColor = boss ? PAL.ember : lvl === 0 ? PAL.gold : "#c9b8f0";
  const label = labelTexture(lvl === 0 ? "L" : String(lvl), {
    color: plateColor,
    bg: "#12081c",
    border: plateColor,
    glow: boss ? PAL.ember : null,
    w: 160,
    h: 128,
    size: 0.62,
  });
  return (
    <group>
      <Bx p={[0, y + fh / 2, -D / 2 - 0.05]} s={[w, fh, 0.1]} m={std(wallColor, { r: 0.9 })} />
      {/* number plate outside the left column */}
      <Pl p={[-w / 2 - 1.35, y + fh * 0.45, 0.4]} s={[1.5, 1.2, 1]} m={basic("#ffffff", { map: label, fog: false })} />
      {boss && (
        <>
          <Bx p={[0, y + fh - 0.2, -D / 2 + 0.05]} s={[w, 0.08, 0.08]} m={basic(PAL.ember)} />
          <sprite position={[w / 2 + 1.3, y + fh * 0.45, 0.4]} scale={[1.1, 1.1, 1]} material={spriteMat(emojiTexture("⚔️"), { fog: false })} />
          <Glow p={[-w / 2 - 1.35, y + fh * 0.45, 0.6]} size={2.6} color={PAL.ember} opacity={0.45} />
        </>
      )}
    </group>
  );
}

function BaseLava({ w }: { w: number }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const bubbles = useRef<THREE.Group>(null);
  const tex = useMemo(() => {
    const t = lavaTexture();
    t.repeat.set(4, 1);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const m = matRef.current;
    if (m?.map) m.map.offset.x = t * 0.03;
    const g = bubbles.current;
    if (g)
      g.children.forEach((c, i) => {
        const ph = (t * 0.6 + i * 0.37) % 1;
        c.position.y = -0.5 + ph * 0.5;
        c.scale.setScalar(0.15 + ph * 0.25);
      });
  });
  return (
    <group>
      <mesh position={[0, -1.3, 0]}>
        <boxGeometry args={[w + 8, 2, D + 4]} />
        <meshBasicMaterial ref={matRef} map={tex} toneMapped={false} fog={false} />
      </mesh>
      <Glow p={[0, -0.2, 2]} size={22} color={PAL.ember} opacity={0.5} />
      <group ref={bubbles}>
        {[-0.57, -0.36, -0.14, 0.11, 0.32, 0.57].map((k) => (
          <Bl key={k} p={[k * w, -0.4, D / 2 + 1.2]} s={0.3} m={basic("#ffb347", { fog: false })} />
        ))}
      </group>
    </group>
  );
}
