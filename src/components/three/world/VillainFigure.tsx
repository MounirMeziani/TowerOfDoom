"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { BlobShadow, Bl, Cn, Cy, Glow, Tp } from "./prims";
import { basic, emojiTexture, spriteMat, std } from "./shared";

export interface VillainFigureProps {
  emoji: string;
  /** Kept as the object's name only; villains are silent flavor (no visible text). */
  name: string;
  position: [number, number, number];
  scale?: number;
}

const RED = "#ff2a4a";

/** Silent menacing flavor figure: dark pedestal, shadow cloak, floating emoji head, red glowing eyes. */
export function VillainFigure({ emoji, name, position, scale = 1 }: VillainFigureProps) {
  const floatRef = useRef<THREE.Group>(null);
  const eyesRef = useRef<THREE.Group>(null);
  const wispRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (floatRef.current) {
      floatRef.current.position.y = Math.sin(t * 1.3) * 0.08;
      floatRef.current.rotation.z = Math.sin(t * 0.7) * 0.04;
    }
    if (eyesRef.current) {
      // occasional blink
      const blink = (t % 4.2) < 0.12 ? 0.15 : 1;
      eyesRef.current.scale.set(1, blink, 1);
    }
    if (wispRef.current) wispRef.current.rotation.y = t * 0.6;
  });

  const tex = emojiTexture(emoji || "👿", 128);
  const dark = std("#160a1f", { r: 0.95 });
  const stone = std("#231430", { r: 0.9 });

  return (
    <group position={position} scale={scale} name={name}>
      <BlobShadow size={2.1} opacity={0.55} />
      {/* pedestal */}
      <Tp p={[0, 0.25, 0]} s={[1, 0.5, 1]} top={0.72} bottom={0.85} segs={6} m={stone} />
      <Tp p={[0, 0.52, 0]} s={[1, 0.06, 1]} top={0.78} bottom={0.78} segs={6} m={basic(RED, { t: 0.9 })} />
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.3, 2.3, 1]}>
        <ringGeometry args={[0.42, 0.5, 6]} />
        <meshBasicMaterial color={RED} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>

      <group ref={floatRef}>
        {/* cloak */}
        <Cn p={[0, 1.25, 0]} s={[0.95, 1.4, 0.8]} segs={7} m={dark} />
        <Bl p={[0, 1.95, -0.02]} s={[0.62, 0.55, 0.58]} m={dark} />
        {/* glowing eyes in the hood */}
        <group ref={eyesRef} position={[0, 1.92, 0.27]}>
          <Bl p={[-0.1, 0, 0]} s={[0.09, 0.05, 0.04]} detail={0} m={basic(RED)} />
          <Bl p={[0.1, 0, 0]} s={[0.09, 0.05, 0.04]} detail={0} m={basic(RED)} />
          <Glow p={[0, 0, 0.02]} size={0.6} color={RED} opacity={0.7} />
        </group>
        {/* the villain's sigil: big emoji billboard */}
        <Glow p={[0, 2.85, -0.1]} size={2.2} color={RED} opacity={0.45} />
        <sprite position={[0, 2.85, 0]} scale={[1.15, 1.15, 1]} material={spriteMat(tex)} />
        {/* smoke wisps orbiting */}
        <group ref={wispRef} position={[0, 1.1, 0]}>
          <Bl p={[0.7, 0, 0]} s={0.16} detail={0} m={dark} />
          <Bl p={[-0.5, 0.4, 0.45]} s={0.12} detail={0} m={dark} />
          <Bl p={[0, 0.8, -0.65]} s={0.1} detail={0} m={dark} />
        </group>
      </group>
      <Cy p={[0, 0.56, 0]} s={[0.3, 0.02, 0.3]} m={basic(RED, { t: 0.6, add: true })} />
    </group>
  );
}
