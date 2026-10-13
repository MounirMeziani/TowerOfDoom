"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DoomEye } from "./DoomEye";
import { BlobShadow, Bl, Bx, Cn, Cy, Glow, Pl, Tp } from "./prims";
import { ELEVATOR_POS, LOBBY_BENCHES, LOBBY_DESK, LOBBY_PILLARS, LOBBY_PLANTS } from "./constants";
import { G, PAL, basic, glowTexture, labelTexture, marbleTexture, rng, std, stormTexture } from "./shared";

const WALL = "#2b1d47";
const WAINSCOT = "#1b1130";
const PILASTER = "#3a2862";
const BRASS = "#c9a24a";
const WOOD = "#4a2f22";

const HALF_W = 13;
const BACK_Z = -11;
const WALL_H = 10;
const WIN = { x0: -5, x1: 5, y0: 1, y1: 8.6 };

/**
 * The tower's ground-floor lobby hall (~26 x 22): checkered dark marble, six pillars, a reception
 * desk with a glowing OLSEN sign, the "12" elevator, a storm window with the Eye of Doom, plants
 * and benches. Includes its own lighting. `elevatorOpen` slides the elevator doors apart.
 */
export function LobbyHall({ elevatorOpen = false }: { elevatorOpen?: boolean } = {}) {
  return (
    <group>
      <LobbyLights />
      <Floor />
      <Walls />
      <StormWindow />
      {LOBBY_PILLARS.map(([x, z]) => (
        <Pillar key={`${x},${z}`} x={x} z={z} />
      ))}
      <ReceptionDesk />
      <Elevator open={elevatorOpen} />
      {LOBBY_BENCHES.map(([x, z]) => (
        <Bench key={`${x},${z}`} x={x} z={z} />
      ))}
      {LOBBY_PLANTS.map(([x, z], i) => (
        <Plant key={`${x},${z}`} x={x} z={z} seed={i} />
      ))}
      <PendantLamps />
      <DustMotes />
    </group>
  );
}

function LobbyLights() {
  return (
    <>
      <hemisphereLight args={["#7d63b8", "#1a0d24", 0.9]} />
      <ambientLight intensity={0.25} color="#b9a6e8" />
      {/* cool storm light from the window */}
      <directionalLight position={[2, 9, -14]} intensity={0.9} color="#8fa6ff" />
      {/* warm ember key from the front-left */}
      <directionalLight position={[-8, 12, 10]} intensity={1.1} color="#ffb38a" />
      <pointLight position={[ELEVATOR_POS[0], 3.2, ELEVATOR_POS[1] + 0.6]} intensity={14} distance={11} decay={2} color={PAL.ember} />
      <pointLight position={[LOBBY_DESK.x + 1.6, 3, LOBBY_DESK.z]} intensity={10} distance={9} decay={2} color={PAL.gold} />
    </>
  );
}

function Floor() {
  const tex = marbleTexture("#1f1433", "#2c1e47", "#b9a6e8", [6.5, 8.25]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 5.5]} geometry={G.plane()} scale={[26, 33, 1]}>
        <meshStandardMaterial map={tex} roughness={0.32} metalness={0.15} />
      </mesh>
      {/* central rug with ember border + emblem ring */}
      <Pl p={[0, 0.006, 2.6]} r={[-Math.PI / 2, 0, 0]} s={[9.4, 11, 1]} m={std("#3a1426", { r: 1 })} />
      <Pl p={[0, 0.008, 2.6]} r={[-Math.PI / 2, 0, 0]} s={[8.6, 10.2, 1]} m={std("#22122f", { r: 1 })} />
      <mesh position={[0, 0.011, 2.6]} scale={[3.6, 1, 3.6]} geometry={G.ring(0.44, 48)} material={basic(PAL.ember, { t: 0.55 })} />
      <mesh position={[0, 0.011, 2.6]} scale={[2.2, 1, 2.2]} geometry={G.ring(0.46, 6)} material={basic(PAL.gold, { t: 0.4 })} />
      {/* ember baseline that leads to the elevator */}
      <Pl p={[ELEVATOR_POS[0], 0.009, -7.6]} r={[-Math.PI / 2, 0, 0]} s={[2.4, 3.2, 1]} m={std("#3a1426", { r: 1 })} />
      <Pl p={[ELEVATOR_POS[0], 0.012, -7.6]} r={[-Math.PI / 2, 0, 0]} s={[0.08, 3.2, 1]} m={basic(PAL.ember, { t: 0.7 })} />
    </group>
  );
}

function Walls() {
  const wall = std(WALL, { r: 0.9 });
  const wains = std(WAINSCOT, { r: 0.9 });
  const pil = std(PILASTER);
  const strip = basic(PAL.ember, { t: 0.85 });
  const midW = WIN.x1 - WIN.x0;
  const sideW = HALF_W - WIN.x1;
  const sconces: number[] = [-7, -1, 5];
  return (
    <group>
      {/* back wall around the window */}
      <Bx p={[-(HALF_W + WIN.x1) / 2 - 0, WALL_H / 2, BACK_Z]} s={[sideW + 0.4, WALL_H, 0.4]} m={wall} />
      <Bx p={[(HALF_W + WIN.x1) / 2, WALL_H / 2, BACK_Z]} s={[sideW + 0.4, WALL_H, 0.4]} m={wall} />
      <Bx p={[0, WIN.y0 / 2, BACK_Z]} s={[midW, WIN.y0, 0.4]} m={wall} />
      <Bx p={[0, (WALL_H + WIN.y1) / 2, BACK_Z]} s={[midW, WALL_H - WIN.y1, 0.4]} m={wall} />
      {/* side walls */}
      <Bx p={[-HALF_W, WALL_H / 2, 0]} s={[0.4, WALL_H, 22.4]} m={wall} />
      <Bx p={[HALF_W, WALL_H / 2, 0]} s={[0.4, WALL_H, 22.4]} m={wall} />
      {/* wainscot + ember baseboard strips */}
      <Bx p={[-HALF_W + 0.25, 0.7, 0]} s={[0.12, 1.4, 22]} m={wains} />
      <Bx p={[HALF_W - 0.25, 0.7, 0]} s={[0.12, 1.4, 22]} m={wains} />
      <Bx p={[-HALF_W + 0.32, 0.08, 0]} s={[0.03, 0.06, 22]} m={strip} />
      <Bx p={[HALF_W - 0.32, 0.08, 0]} s={[0.03, 0.06, 22]} m={strip} />
      <Bx p={[-9, 0.08, BACK_Z + 0.22]} s={[8, 0.06, 0.03]} m={strip} />
      {/* pilasters + wall sconces */}
      {sconces.map((z) => (
        <group key={z}>
          <Bx p={[-HALF_W + 0.3, WALL_H / 2, z]} s={[0.3, WALL_H, 0.8]} m={pil} />
          <Bx p={[HALF_W - 0.3, WALL_H / 2, z]} s={[0.3, WALL_H, 0.8]} m={pil} />
          <Bx p={[-HALF_W + 0.5, 3.6, z]} s={[0.2, 0.5, 0.3]} m={basic(PAL.gold)} />
          <Bx p={[HALF_W - 0.5, 3.6, z]} s={[0.2, 0.5, 0.3]} m={basic(PAL.gold)} />
          <Glow p={[-HALF_W + 0.8, 3.7, z]} size={2} color={PAL.ember2} opacity={0.5} />
          <Glow p={[HALF_W - 0.8, 3.7, z]} size={2} color={PAL.ember2} opacity={0.5} />
        </group>
      ))}
      {/* cornice */}
      <Bx p={[-HALF_W + 0.4, WALL_H - 0.3, 0]} s={[0.6, 0.3, 22.4]} m={pil} />
      <Bx p={[HALF_W - 0.4, WALL_H - 0.3, 0]} s={[0.6, 0.3, 22.4]} m={pil} />
      <Bx p={[0, WALL_H - 0.3, BACK_Z + 0.3]} s={[26.4, 0.3, 0.6]} m={pil} />
    </group>
  );
}

function StormWindow() {
  const stormMat = useRef<THREE.MeshBasicMaterial>(null);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = stormTexture();
  const frame = std("#140b22", { m: 0.4, r: 0.5 });
  const cx = (WIN.x0 + WIN.x1) / 2;
  const cy = (WIN.y0 + WIN.y1) / 2;
  const w = WIN.x1 - WIN.x0;
  const h = WIN.y1 - WIN.y0;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // two quick lightning pulses every ~7s
    const p = t % 7.3;
    const flash = p < 0.08 ? 1 : p > 0.18 && p < 0.26 ? 0.6 : 0;
    if (stormMat.current) stormMat.current.color.setScalar(0.85 + flash * 1.4);
    if (flashMat.current) flashMat.current.opacity = flash * 0.35;
  });

  return (
    <group>
      {/* storm sky beyond the glass */}
      <mesh position={[cx, cy + 1.5, BACK_Z - 6]} scale={[w * 2.6, h * 1.9, 1]} geometry={G.plane()}>
        <meshBasicMaterial ref={stormMat} map={tex} toneMapped={false} fog={false} />
      </mesh>
      <DoomEye position={[cx, cy + 1.2, BACK_Z - 4.5]} scale={1.15} fog={false} />
      {/* glass + lightning flash */}
      <mesh position={[cx, cy, BACK_Z + 0.05]} scale={[w, h, 1]} geometry={G.plane()}>
        <meshBasicMaterial ref={flashMat} color="#cdd6ff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <Pl p={[cx, cy, BACK_Z + 0.04]} s={[w, h, 1]} m={basic("#6b7cff", { t: 0.06, add: true })} />
      {/* mullions */}
      {[-2.5, 0, 2.5].map((x) => (
        <Bx key={x} p={[cx + x, cy, BACK_Z + 0.1]} s={[0.14, h, 0.16]} m={frame} />
      ))}
      <Bx p={[cx, WIN.y0 + h * 0.62, BACK_Z + 0.1]} s={[w, 0.14, 0.16]} m={frame} />
      <Bx p={[cx, WIN.y0, BACK_Z + 0.15]} s={[w + 0.4, 0.22, 0.4]} m={frame} />
      <Bx p={[cx, WIN.y1, BACK_Z + 0.15]} s={[w + 0.4, 0.22, 0.4]} m={frame} />
      <Bx p={[WIN.x0, cy, BACK_Z + 0.15]} s={[0.22, h, 0.4]} m={frame} />
      <Bx p={[WIN.x1, cy, BACK_Z + 0.15]} s={[0.22, h, 0.4]} m={frame} />
      {/* cool light spill on the floor */}
      <Pl p={[cx, 0.013, BACK_Z + 3]} r={[-Math.PI / 2, 0, 0]} s={[w * 1.05, 5, 1]} m={basic("#5b6bd8", { t: 0.08, add: true })} />
    </group>
  );
}

function Pillar({ x, z }: { x: number; z: number }) {
  const stone = std("#3b2a5e", { r: 0.55 });
  const dark = std("#22163a");
  return (
    <group position={[x, 0, z]}>
      <BlobShadow size={2} opacity={0.4} />
      <Bx p={[0, 0.3, 0]} s={[1.4, 0.6, 1.4]} m={dark} />
      <Cy p={[0, 5, 0]} s={[1.05, 9.4, 1.05]} segs={8} m={stone} />
      <Cy p={[0, 3, 0]} s={[1.12, 0.12, 1.12]} segs={8} m={basic(PAL.ember)} />
      <Bx p={[0, 9.8, 0]} s={[1.5, 0.5, 1.5]} m={dark} />
      <Glow p={[0, 3, 0.7]} size={1.4} color={PAL.ember} opacity={0.4} />
    </group>
  );
}

function ReceptionDesk() {
  const { x, z, len } = LOBBY_DESK;
  const body = std("#2c1b46", { r: 0.6 });
  const top = std("#4a3570", { r: 0.35, m: 0.2 });
  const sign = labelTexture("OLSEN", { color: PAL.gold, glow: PAL.ember, w: 512, h: 128, size: 0.7 });
  return (
    <group>
      <group position={[x, 0, z]}>
        <BlobShadow size={3.4} opacity={0.4} />
        <Bx p={[0, 0.55, 0]} s={[1.3, 1.1, len]} m={body} />
        <Bx p={[0.05, 1.14, 0]} s={[1.5, 0.08, len + 0.3]} m={top} />
        <Bx p={[0.67, 0.55, 0]} s={[0.04, 0.12, len - 0.3]} m={basic(PAL.ember)} />
        <Bx p={[0.67, 0.25, 0]} s={[0.04, 0.05, len - 0.3]} m={basic(PAL.gold, { t: 0.8 })} />
        {/* monitor + bell + paper */}
        <Bx p={[-0.25, 1.45, -1]} s={[0.08, 0.45, 0.7]} m={std("#120a1e")} />
        <Pl p={[-0.2, 1.45, -1]} r={[0, Math.PI / 2, 0]} s={[0.62, 0.38, 1]} m={basic(PAL.giving, { t: 0.7 })} />
        <Cy p={[-0.25, 1.22, -1]} s={[0.08, 0.16, 0.08]} m={std("#120a1e")} />
        <Bl p={[0.3, 1.24, 1.1]} s={[0.2, 0.14, 0.2]} m={std(BRASS, { m: 0.7, r: 0.3 })} />
        <Bx p={[0.2, 1.21, 0.3]} s={[0.4, 0.06, 0.3]} r={[0, 0.2, 0]} m={std("#e8e2f4")} />
      </group>
      {/* glowing OLSEN sign on the wall behind */}
      <Bx p={[-HALF_W + 0.28, 4.4, z]} s={[0.12, 1.5, 5]} m={std("#140b22")} />
      <Pl p={[-HALF_W + 0.36, 4.4, z]} r={[0, Math.PI / 2, 0]} s={[4.8, 1.2, 1]} m={basic("#ffffff", { map: sign })} />
      <Glow p={[-HALF_W + 0.9, 4.4, z]} size={5} color={PAL.ember} opacity={0.25} />
    </group>
  );
}

function Elevator({ open }: { open: boolean }) {
  const leftRef = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const [ex] = ELEVATOR_POS;
  const z = BACK_Z + 0.5;
  const sign = labelTexture("12", { color: PAL.ember, glow: PAL.ember, bg: "#12081c", border: PAL.ember, w: 256, h: 160, size: 0.66 });
  const arrow = labelTexture("▲", { color: PAL.gold, glow: PAL.gold, w: 128, h: 128, size: 0.6 });
  const frame = std(BRASS, { m: 0.7, r: 0.35 });
  const door = std("#4a4366", { m: 0.6, r: 0.35 });
  const strip = basic(PAL.ember);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.1));
    const target = open ? 1.18 : 0.6;
    if (leftRef.current) leftRef.current.position.x += (-target - leftRef.current.position.x) * k;
    if (rightRef.current) rightRef.current.position.x += (target - rightRef.current.position.x) * k;
  });

  return (
    <group position={[ex, 0, z]}>
      {/* lit cabin behind the doors */}
      <Bx p={[0, 1.7, -0.25]} s={[2.4, 3.4, 0.1]} m={basic("#ffb066")} />
      <Glow p={[0, 1.7, 0.2]} size={open ? 5 : 2.5} color={PAL.ember2} opacity={open ? 0.6 : 0.25} />
      {/* doors */}
      <group ref={leftRef} position={[-0.6, 0, 0]}>
        <Bx p={[0, 1.7, 0]} s={[1.18, 3.4, 0.12]} m={door} />
        <Bx p={[0.5, 1.7, 0.07]} s={[0.04, 3.2, 0.02]} m={std("#2a2440")} />
      </group>
      <group ref={rightRef} position={[0.6, 0, 0]}>
        <Bx p={[0, 1.7, 0]} s={[1.18, 3.4, 0.12]} m={door} />
        <Bx p={[-0.5, 1.7, 0.07]} s={[0.04, 3.2, 0.02]} m={std("#2a2440")} />
      </group>
      {/* frame */}
      <Bx p={[-1.35, 1.8, 0.1]} s={[0.3, 3.6, 0.3]} m={frame} />
      <Bx p={[1.35, 1.8, 0.1]} s={[0.3, 3.6, 0.3]} m={frame} />
      <Bx p={[0, 3.6, 0.1]} s={[3, 0.3, 0.3]} m={frame} />
      {/* ember light strips */}
      <Bx p={[-1.55, 1.8, 0.12]} s={[0.06, 3.6, 0.06]} m={strip} />
      <Bx p={[1.55, 1.8, 0.12]} s={[0.06, 3.6, 0.06]} m={strip} />
      <Bx p={[0, 3.82, 0.12]} s={[3.2, 0.06, 0.06]} m={strip} />
      {/* "12" sign + up arrow */}
      <Pl p={[0, 4.55, 0.1]} s={[1.6, 1, 1]} m={basic("#ffffff", { map: sign })} />
      <Pl p={[1.15, 4.55, 0.1]} s={[0.55, 0.55, 1]} m={basic("#ffffff", { map: arrow })} />
      <Glow p={[0, 4.55, 0.4]} size={3} color={PAL.ember} opacity={0.4} />
      {/* call button */}
      <Bx p={[1.8, 1.3, 0.05]} s={[0.25, 0.4, 0.06]} m={frame} />
      <Bl p={[1.8, 1.3, 0.1]} s={0.1} m={basic(PAL.gold)} />
    </group>
  );
}

function Bench({ x, z }: { x: number; z: number }) {
  const wood = std(WOOD);
  const metal = std("#1a1128", { m: 0.5 });
  return (
    <group position={[x, 0, z]}>
      <BlobShadow size={2.6} opacity={0.35} />
      {[-0.2, 0, 0.2].map((dx) => (
        <Bx key={dx} p={[dx, 0.48, 0]} s={[0.17, 0.07, 2.4]} m={wood} />
      ))}
      <Bx p={[0.32, 0.85, 0]} s={[0.07, 0.4, 2.4]} m={wood} />
      <Bx p={[0, 0.22, -1]} s={[0.6, 0.44, 0.08]} m={metal} />
      <Bx p={[0, 0.22, 1]} s={[0.6, 0.44, 0.08]} m={metal} />
    </group>
  );
}

function Plant({ x, z, seed }: { x: number; z: number; seed: number }) {
  const leaves = useMemo(() => {
    const r = rng(100 + seed);
    return Array.from({ length: 5 }, (_, i) => ({
      a: (i / 5) * Math.PI * 2 + r() * 0.6,
      tilt: 0.35 + r() * 0.35,
      h: 0.9 + r() * 0.6,
    }));
  }, [seed]);
  const leaf = std("#2f8a5c");
  const leaf2 = std("#3ddc97", { r: 0.7 });
  return (
    <group position={[x, 0, z]}>
      <BlobShadow size={1.3} opacity={0.4} />
      <Tp p={[0, 0.35, 0]} s={[1, 0.7, 1]} top={0.42} bottom={0.3} segs={8} m={std("#3a2860")} />
      <Cy p={[0, 0.71, 0]} s={[0.86, 0.04, 0.86]} segs={8} m={std(BRASS, { m: 0.6 })} />
      {leaves.map((l, i) => (
        <Cn
          key={i}
          p={[Math.sin(l.a) * 0.18, 0.7 + l.h / 2, Math.cos(l.a) * 0.18]}
          s={[0.32, l.h, 0.32]}
          r={[Math.cos(l.a) * l.tilt, 0, -Math.sin(l.a) * l.tilt]}
          segs={4}
          m={i % 2 ? leaf : leaf2}
        />
      ))}
    </group>
  );
}

function PendantLamps() {
  const spots: Array<[number, number]> = [
    [-3, -3],
    [3, -3],
    [-3, 6],
    [3, 6],
  ];
  const cord = basic("#0e0718");
  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <Cy p={[0, 9, 0]} s={[0.03, 2.2, 0.03]} segs={4} m={cord} />
          <Cn p={[0, 7.8, 0]} s={[0.9, 0.5, 0.9]} r={[Math.PI, 0, 0]} segs={8} m={std(BRASS, { m: 0.6, r: 0.4 })} />
          <Bl p={[0, 7.55, 0]} s={0.32} m={basic("#ffe2a8")} />
          <Glow p={[0, 7.4, 0]} size={2.6} color={PAL.ember2} opacity={0.55} />
          <mesh position={[0, 0.014, 0]} scale={[2.6, 1, 2.6]} geometry={G.disc(24)} material={basic(PAL.ember2, { t: 0.16, add: true, map: glowTexture() })} />
        </group>
      ))}
    </group>
  );
}

const MOTE_COUNT = 70;

function DustMotes() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const r = rng(77);
    const arr = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i++) {
      arr[i * 3] = (r() - 0.5) * 24;
      arr[i * 3 + 1] = 0.5 + r() * 7;
      arr[i * 3 + 2] = -10 + r() * 20;
    }
    return arr;
  }, []);
  useFrame((state) => {
    const p = ref.current;
    if (!p) return;
    p.position.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.4;
    p.rotation.y = state.clock.elapsedTime * 0.01;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffcf9a" size={0.07} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
    </points>
  );
}
