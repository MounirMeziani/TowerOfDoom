"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BlobShadow, Bl, Bx, Cn, Cy, Glow, Tp } from "./prims";
import { G, PAL, basic, glowMat, std } from "./shared";

export interface SenseiModelProps {
  position: [number, number, number];
  variant: "sensei" | "grand";
  /** Speaking: nods, aura brightens. */
  talking?: boolean;
  /** Waiting for the player: floating "!" above the head. */
  waiting?: boolean;
  /** Ground point [x, z] to turn toward (null = face the room front, +z). */
  lookAt?: [number, number] | null;
}

const LOOK = {
  sensei: { robe: "#ece3cf", trim: PAL.ember, sash: "#b5361c", aura: "#9be7ff", orb: "#9be7ff", scale: 1 },
  grand: { robe: "#e8b931", trim: "#fff1b8", sash: "#3b1d5e", aura: PAL.gold, orb: "#fff4c2", scale: 1.5 },
} as const;

const BEARD = "#f6f3ee";
const STAFF = "#6b4a2e";

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Robed low-poly elder with a white beard, staff, glowing aura and an optional floating "!". */
export function SenseiModel({ position, variant, talking = false, waiting = false, lookAt = null }: SenseiModelProps) {
  const look = LOOK[variant];
  const bangY = variant === "grand" ? 2.8 : 2.45;
  const turnRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bangRef = useRef<THREE.Group>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const auraMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const orbRef = useRef<THREE.Sprite>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const step = Math.min(dt, 0.1);
    const turn = turnRef.current;
    if (turn) {
      const target = lookAt ? Math.atan2(lookAt[0] - position[0], lookAt[1] - position[2]) : 0;
      turn.rotation.y += shortestAngle(turn.rotation.y, target) * (1 - Math.exp(-6 * step));
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 1.6) * 0.025;
      bodyRef.current.rotation.z = Math.sin(t * 0.8) * 0.015;
    }
    if (headRef.current) {
      headRef.current.rotation.x = talking ? Math.sin(t * 7) * 0.09 + 0.05 : Math.sin(t * 0.9) * 0.03;
    }
    if (bangRef.current) {
      bangRef.current.visible = waiting && !talking;
      bangRef.current.position.y = bangY + Math.sin(t * 3) * 0.1;
      bangRef.current.rotation.y = t * 1.6;
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * (talking ? 4 : 1.8));
    if (auraRef.current) {
      const s = (variant === "grand" ? 2.3 : 1.8) * (1 + pulse * 0.08);
      auraRef.current.scale.set(s, 1, s);
    }
    if (auraMatRef.current) auraMatRef.current.opacity = (talking ? 0.6 : 0.32) + pulse * 0.2;
    if (orbRef.current) {
      const s = 0.55 + pulse * 0.2;
      orbRef.current.scale.set(s, s, 1);
    }
  });

  const robe = std(look.robe, { r: 0.9 });
  const trim = std(look.trim, { e: look.trim, ei: 0.35 });
  const sash = std(look.sash);
  const skin = std(PAL.skin);
  const beard = std(BEARD, { r: 1 });
  const dark = std("#2a1a20");

  return (
    <group position={position} scale={look.scale}>
      <BlobShadow size={1.5} opacity={0.5} />
      {/* ground aura ring */}
      <mesh ref={auraRef} position={[0, 0.02, 0]} geometry={G.ring(0.72, 48)} renderOrder={2}>
        <meshBasicMaterial
          ref={auraMatRef}
          color={look.aura}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {variant === "grand" && (
        <mesh position={[0, 0.025, 0]} scale={[3, 1, 3]} geometry={G.ring(0.9, 48)} material={basic(PAL.ember, { t: 0.35, add: true })} />
      )}
      <Glow p={[0, 1.1, -0.35]} size={variant === "grand" ? 3.4 : 2.6} color={look.aura} opacity={talking ? 0.35 : 0.2} />

      <group ref={turnRef}>
        <group ref={bodyRef}>
          {/* robe */}
          <Tp p={[0, 0.66, 0]} s={[1, 1.3, 1]} top={0.27} bottom={0.62} segs={8} m={robe} />
          <Tp p={[0, 0.05, 0]} s={[1, 0.1, 1]} top={0.62} bottom={0.65} segs={8} m={trim} />
          {/* lapels */}
          <Bx p={[-0.08, 1.12, 0.29]} s={[0.07, 0.42, 0.04]} r={[0.12, 0, 0.35]} m={trim} />
          <Bx p={[0.08, 1.12, 0.29]} s={[0.07, 0.42, 0.04]} r={[0.12, 0, -0.35]} m={trim} />
          {/* sash + knot tails */}
          <Cy p={[0, 0.92, 0]} s={[0.78, 0.13, 0.78]} m={sash} />
          <Bx p={[0.12, 0.74, 0.36]} s={[0.08, 0.3, 0.04]} r={[0.2, 0, 0.15]} m={sash} />
          <Bx p={[0.2, 0.76, 0.33]} s={[0.08, 0.26, 0.04]} r={[0.2, 0, -0.1]} m={sash} />
          {/* shoulders */}
          <Bl p={[0, 1.3, 0]} s={[0.78, 0.34, 0.52]} m={robe} />
          {/* left sleeve + hand resting in front */}
          <Tp p={[-0.33, 1.08, 0.12]} s={[1, 0.5, 1]} r={[0.7, 0, 0.35]} top={0.11} bottom={0.17} m={robe} />
          <Bl p={[-0.2, 0.92, 0.36]} s={0.17} m={skin} />
          {/* right sleeve + hand on staff */}
          <Tp p={[0.38, 1.1, 0.1]} s={[1, 0.5, 1]} r={[0.5, 0, -0.5]} top={0.11} bottom={0.17} m={robe} />
          <Bl p={[0.5, 0.98, 0.26]} s={0.17} m={skin} />
          {/* staff */}
          <Cy p={[0.52, 1.05, 0.28]} s={[0.07, 2.1, 0.07]} segs={6} m={std(STAFF)} />
          <Bl p={[0.52, 2.15, 0.28]} s={0.2} m={basic(look.orb)} />
          <sprite ref={orbRef} position={[0.52, 2.15, 0.28]} scale={[0.6, 0.6, 1]} material={glowMat(look.orb, 0.7)} />

          {/* head */}
          <group ref={headRef} position={[0, 1.6, 0]}>
            <Bl p={[0, 0.02, 0]} s={0.52} m={skin} />
            <Bl p={[-0.26, 0, 0]} s={[0.09, 0.13, 0.09]} m={skin} />
            <Bl p={[0.26, 0, 0]} s={[0.09, 0.13, 0.09]} m={skin} />
            {/* side + back hair */}
            <Bx p={[-0.22, 0.04, -0.08]} s={[0.1, 0.18, 0.3]} m={beard} />
            <Bx p={[0.22, 0.04, -0.08]} s={[0.1, 0.18, 0.3]} m={beard} />
            <Bx p={[0, 0.02, -0.22]} s={[0.4, 0.2, 0.1]} m={beard} />
            {/* topknot */}
            <Bl p={[0, 0.3, -0.05]} s={0.15} m={beard} />
            <Cy p={[0, 0.25, -0.04]} s={[0.12, 0.04, 0.12]} m={sash} />
            {/* eyebrows (bushy, angled) */}
            <Bx p={[-0.1, 0.1, 0.235]} s={[0.15, 0.05, 0.05]} r={[0, 0, -0.25]} m={beard} />
            <Bx p={[0.1, 0.1, 0.235]} s={[0.15, 0.05, 0.05]} r={[0, 0, 0.25]} m={beard} />
            {/* calm eyes */}
            <Bx p={[-0.09, 0.04, 0.245]} s={[0.07, 0.02, 0.02]} m={dark} />
            <Bx p={[0.09, 0.04, 0.245]} s={[0.07, 0.02, 0.02]} m={dark} />
            {/* nose */}
            <Bl p={[0, -0.02, 0.26]} s={[0.07, 0.08, 0.07]} m={skin} />
            {/* mustache */}
            <Bx p={[-0.08, -0.08, 0.24]} s={[0.15, 0.05, 0.05]} r={[0, 0, 0.45]} m={beard} />
            <Bx p={[0.08, -0.08, 0.24]} s={[0.15, 0.05, 0.05]} r={[0, 0, -0.45]} m={beard} />
            {/* long beard */}
            <Cn p={[0, -0.42, 0.15]} s={[0.4, 0.75, 0.26]} r={[Math.PI + 0.12, 0, 0]} segs={6} m={beard} />
            {variant === "grand" && (
              <>
                {/* tall ceremonial hat */}
                <Cy p={[0, 0.22, 0]} s={[0.5, 0.06, 0.5]} m={trim} />
                <Cn p={[0, 0.5, 0]} s={[0.38, 0.55, 0.38]} segs={8} m={std(look.robe, { e: PAL.gold, ei: 0.25 })} />
                <Bl p={[0, 0.8, 0]} s={0.1} m={basic(PAL.ember)} />
              </>
            )}
          </group>
        </group>
      </group>

      {/* floating "!" (waiting for the player) */}
      <group ref={bangRef} position={[0, bangY, 0]} visible={waiting && !talking}>
        <Bx p={[0, 0.16, 0]} s={[0.13, 0.36, 0.13]} m={basic(PAL.gold)} />
        <Bx p={[0, -0.13, 0]} s={[0.13, 0.13, 0.13]} m={basic(PAL.gold)} />
        <Glow p={[0, 0.05, 0]} size={1.1} color={PAL.gold} opacity={0.55} />
      </group>
    </group>
  );
}
