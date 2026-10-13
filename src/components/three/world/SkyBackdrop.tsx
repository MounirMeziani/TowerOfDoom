"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Bl } from "./prims";
import { PAL, basic, glowMat, glowTexture, gradientTexture, lavaTexture, rng } from "./shared";

export type SkyVariant = "storm" | "victory" | "doom";

const SKIES: Record<SkyVariant, Array<[number, string]>> = {
  storm: [
    [0, "#3a1f4a"],
    [0.45, "#1c0f33"],
    [0.6, "#100820"],
    [1, "#05030b"],
  ],
  victory: [
    [0, "#ffcf4a"],
    [0.42, "#ff9a3d"],
    [0.55, "#c85a8a"],
    [0.75, "#4a3a9a"],
    [1, "#1a1a4a"],
  ],
  doom: [
    [0, "#ff3a1a"],
    [0.42, "#7a1408"],
    [0.55, "#3a0a0a"],
    [1, "#0b0614"],
  ],
};

const RADIUS = 80;

/** Full-surround sky (back-side sphere, ignores fog) with storm, victory or doom dressing. */
export function SkyBackdrop({ variant }: { variant: SkyVariant }) {
  const skyMat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = gradientTexture(SKIES[variant]);

  useFrame((state) => {
    if (variant !== "storm" || !skyMat.current) return;
    const p = state.clock.elapsedTime % 6.1;
    const flash = p < 0.07 ? 1 : p > 0.16 && p < 0.22 ? 0.5 : 0;
    skyMat.current.color.setScalar(1 + flash * 1.6);
  });

  return (
    <group>
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[RADIUS, 24, 16]} />
        <meshBasicMaterial ref={skyMat} map={tex} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {variant === "storm" && <StormClouds />}
      {variant === "victory" && <VictorySky />}
      {variant === "doom" && <DoomSky />}
    </group>
  );
}

function StormClouds() {
  const ref = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const r = rng(314);
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + r() * 0.3;
      const d = 45 + r() * 12;
      return { x: Math.sin(a) * d, y: 8 + r() * 14, z: Math.cos(a) * d, s: 8 + r() * 10, light: r() < 0.3 };
    });
  }, []);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.01;
  });
  const dark = basic("#140a24", { fog: false, tm: false });
  const lit = basic("#3a2660", { fog: false, tm: false });
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          <Bl p={[0, 0, 0]} s={[c.s, c.s * 0.35, c.s * 0.6]} detail={0} m={c.light ? lit : dark} />
          <Bl p={[c.s * 0.35, -c.s * 0.05, 0]} s={[c.s * 0.6, c.s * 0.25, c.s * 0.45]} detail={0} m={dark} />
        </group>
      ))}
    </group>
  );
}

function VictorySky() {
  const sparkRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const r = rng(2024);
    const n = 160;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 6 + r() * 30;
      arr[i * 3] = Math.sin(a) * d;
      arr[i * 3 + 1] = r() * 26 - 4;
      arr[i * 3 + 2] = Math.cos(a) * d;
    }
    return arr;
  }, []);
  useFrame((state) => {
    const p = sparkRef.current;
    if (!p) return;
    p.rotation.y = state.clock.elapsedTime * 0.04;
    p.position.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.6;
  });
  const cloud = basic("#ffd9c2", { t: 0.55, fog: false });
  const clouds = useMemo(() => {
    const r = rng(88);
    return Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + r() * 0.4;
      const d = 50 + r() * 10;
      return { x: Math.sin(a) * d, y: -2 + r() * 6, z: Math.cos(a) * d, s: 7 + r() * 8 };
    });
  }, []);
  return (
    <group>
      {/* rising sun */}
      <sprite position={[0, 6, -60]} scale={[60, 60, 1]} material={glowMat("#ffcf4a", 0.8, false)} />
      <mesh position={[0, 6, -62]}>
        <circleGeometry args={[7, 32]} />
        <meshBasicMaterial color="#fff1b8" fog={false} toneMapped={false} />
      </mesh>
      {clouds.map((c, i) => (
        <Bl key={i} p={[c.x, c.y, c.z]} s={[c.s, c.s * 0.25, c.s * 0.5]} detail={0} m={cloud} />
      ))}
      <points ref={sparkRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowTexture()}
          color={PAL.gold}
          size={0.6}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}

const EMBERS = 140;

function DoomSky() {
  const emberRef = useRef<THREE.Points>(null);
  const lavaMat = useRef<THREE.MeshBasicMaterial>(null);
  const lava = useMemo(() => {
    const t = lavaTexture();
    t.repeat.set(14, 14);
    return t;
  }, []);
  useEffect(() => () => lava.dispose(), [lava]);

  const positions = useMemo(() => {
    const r = rng(666);
    const arr = new Float32Array(EMBERS * 3);
    for (let i = 0; i < EMBERS; i++) {
      arr[i * 3] = (r() - 0.5) * 50;
      arr[i * 3 + 1] = -6 + r() * 30;
      arr[i * 3 + 2] = (r() - 0.5) * 50;
    }
    return arr;
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const pts = emberRef.current;
    if (pts) {
      const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const step = Math.min(dt, 0.1);
      for (let i = 0; i < EMBERS; i++) {
        let y = arr[i * 3 + 1] + step * (1 + (i % 7) * 0.3);
        if (y > 24) y = -6;
        arr[i * 3 + 1] = y;
        arr[i * 3] += Math.sin(t + i) * step * 0.3;
      }
      attr.needsUpdate = true;
    }
    const m = lavaMat.current;
    if (m?.map) {
      m.map.offset.x = t * 0.01;
      m.map.offset.y = Math.sin(t * 0.1) * 0.2;
    }
  });

  return (
    <group>
      {/* lava sea below */}
      <mesh position={[0, -7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RADIUS - 2, 32]} />
        <meshBasicMaterial ref={lavaMat} map={lava} fog={false} toneMapped={false} />
      </mesh>
      <sprite position={[0, -4, -40]} scale={[70, 70, 1]} material={glowMat(PAL.ember, 0.5, false)} />
      <points ref={emberRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowTexture()}
          color={PAL.ember2}
          size={0.5}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
