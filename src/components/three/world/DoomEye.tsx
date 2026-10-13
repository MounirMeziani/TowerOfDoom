"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { Bl, Bx, Glow } from "./prims";
import { PAL, basic } from "./shared";

/** The glowing Eye of Doom: an ember almond with a wandering slit pupil and the odd blink. */
export function DoomEye({
  position,
  scale = 1,
  fog = true,
}: {
  position: [number, number, number];
  scale?: number;
  fog?: boolean;
}) {
  const lidRef = useRef<THREE.Group>(null);
  const irisRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (irisRef.current) {
      irisRef.current.position.x = Math.sin(t * 0.45) * 0.45 + Math.sin(t * 1.7) * 0.05;
      irisRef.current.position.y = Math.sin(t * 0.3) * 0.08;
    }
    if (lidRef.current) {
      const phase = t % 6.5;
      const blink = phase < 0.18 ? Math.abs(Math.cos((phase / 0.18) * Math.PI)) : 1;
      lidRef.current.scale.y = Math.max(0.06, blink);
    }
  });

  return (
    <group position={position} scale={scale}>
      <Glow p={[0, 0, -0.3]} size={6} color={PAL.ember} opacity={0.55} />
      <Glow p={[0, 0, -0.2]} size={3.2} color="#ffb347" opacity={0.5} />
      <group ref={lidRef}>
        <Bl p={[0, 0, 0]} s={[2.6, 1.15, 0.35]} m={basic("#ffb347", { fog })} />
        <Bl p={[0, 0, 0.02]} s={[2.25, 0.95, 0.35]} m={basic("#ffd98a", { fog })} />
        <group ref={irisRef} position={[0, 0, 0.12]}>
          <Bl p={[0, 0, 0]} s={[0.95, 0.95, 0.25]} detail={2} m={basic("#ff3a1a", { fog })} />
          <Bl p={[0, 0, 0.04]} s={[0.6, 0.6, 0.22]} detail={2} m={basic("#b3120a", { fog })} />
          <Bx p={[0, 0, 0.17]} s={[0.13, 0.78, 0.05]} m={basic("#090306", { fog })} />
        </group>
      </group>
    </group>
  );
}
