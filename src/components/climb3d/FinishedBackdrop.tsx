"use client";

/**
 * 3D backdrop behind the (DOM) FinishedScreen: the hero on the tower roof at dawn (victory) or on a
 * last rock above the lava (doomed), with a slow orbiting camera. Decorative only. Load with
 * next/dynamic({ ssr: false }).
 */

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, DoubleSide, type Mesh, type PerspectiveCamera } from "three";
import { GameCanvas, HeroModel, resetDebug, usePrefersReducedMotion } from "@/components/three/kit";
import { SkyBackdrop } from "@/components/three/world";

const GOLD = "#ffcf4a";
const EMBER = "#ff6b2c";
const LAVA = "#ff3b1a";

/**
 * Slow orbit around the hero. The DOM result card covers the middle of the screen, so the view is
 * shifted: the hero sits in the band above the card on portrait / standard screens and in the
 * empty margin left of the card on wide ones.
 */
function OrbitCamera() {
  const reduce = usePrefersReducedMotion();
  useFrame(({ camera, clock, size }) => {
    const cam = camera as PerspectiveCamera;
    const w = size.width;
    const h = Math.max(1, size.height);
    const aspect = w / h;
    const wide = aspect > 1.2;
    const radius = wide ? 6.2 : 9;
    const height = wide ? 2.4 : 3.2;
    const pull = aspect < 0.8 ? 1.4 : 1;
    const t = reduce ? 0.6 : clock.elapsedTime * 0.12;
    cam.position.set(Math.sin(t) * radius * pull, height * pull, Math.cos(t) * radius * pull);
    cam.lookAt(0, 0.9, 0);
    // Re-applied every frame so fullWidth / fullHeight follow resizes (updates the projection itself).
    if (wide) cam.setViewOffset(w, h, Math.round(w * 0.3), Math.round(h * 0.12), w, h);
    else cam.setViewOffset(w, h, 0, Math.round(h * 0.31), w, h);
  });
  return null;
}

const EMBER_COUNT = 48;

function makeEmberGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const pos = new Float32Array(EMBER_COUNT * 3);
  for (let i = 0; i < EMBER_COUNT; i++) {
    const a = (i / EMBER_COUNT) * Math.PI * 2 * 7.3;
    const r = 1.6 + ((i * 37) % 11) * 0.7;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = -1.2 + ((i * 53) % 29) / 6;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  g.setAttribute("position", new BufferAttribute(pos, 3));
  return g;
}

/** Sparks drifting up from the lava (doomed). */
function Embers() {
  const [geo] = useState(makeEmberGeometry);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    const attr = geo.getAttribute("position") as BufferAttribute;
    const arr = attr.array as Float32Array;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < EMBER_COUNT; i++) {
      let y = arr[i * 3 + 1] + step * (0.5 + (i % 5) * 0.15);
      if (y > 4) y = -1.2;
      arr[i * 3 + 1] = y;
    }
    attr.needsUpdate = true;
  });
  return (
    <points geometry={geo}>
      <pointsMaterial color={EMBER} size={0.09} sizeAttenuation transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </points>
  );
}

function Crown() {
  const ref = useRef<Mesh>(null);
  const reduce = usePrefersReducedMotion();
  useFrame(({ clock }) => {
    if (reduce) return;
    const m = ref.current;
    if (!m) return;
    m.rotation.y = clock.elapsedTime * 1.4;
    m.position.y = 2.15 + Math.sin(clock.elapsedTime * 2) * 0.08;
  });
  return (
    <mesh ref={ref} position={[0, 2.15, 0]}>
      <cylinderGeometry args={[0.26, 0.2, 0.22, 6, 1, true]} />
      <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.6} metalness={0.7} roughness={0.3} flatShading side={DoubleSide} />
    </mesh>
  );
}

export default function FinishedBackdrop({
  outcome,
  heroId,
  playerName,
}: {
  outcome: "victory" | "doomed";
  heroId: string;
  playerName: string;
}) {
  const victory = outcome === "victory";

  useEffect(() => {
    resetDebug("climb", { questionOpen: false, nearSensei: false });
  }, []);

  return (
    <GameCanvas camera={{ position: [0, 2.4, 6.2], fov: 50 }}>
      <SkyBackdrop variant={victory ? "victory" : "doom"} />
      <hemisphereLight args={[victory ? "#ffe2b0" : "#ff8a6a", "#1a0d24", victory ? 1.1 : 0.8]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 8, 6]} intensity={victory ? 1.4 : 0.9} color={victory ? "#fff1d6" : "#ffb38a"} />
      <pointLight position={[0, 0.6, 0]} intensity={victory ? 6 : 10} distance={8} decay={2} color={victory ? GOLD : EMBER} />

      {/* Roof slab (victory) or a last rock above the lava (doomed) */}
      {victory ? (
        <group>
          <mesh position={[0, -0.25, 0]}>
            <boxGeometry args={[5, 0.5, 5]} />
            <meshStandardMaterial color="#2a1a40" flatShading roughness={0.8} />
          </mesh>
          {/* Lighter rim so the slab doesn't read as a black block */}
          <mesh position={[0, -0.045, 0]}>
            <boxGeometry args={[5.16, 0.08, 5.16]} />
            <meshStandardMaterial color="#4a2f6e" emissive="#4a2f6e" emissiveIntensity={0.35} flatShading roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.9, 1.15, 32]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[1.1, 1.6, 1.2, 7]} />
            <meshStandardMaterial color="#2a1414" flatShading roughness={0.95} />
          </mesh>
          {/* Lava sea around the rock */}
          <mesh position={[0, -1.2, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[30, 48]} />
            <meshBasicMaterial color={LAVA} toneMapped={false} />
          </mesh>
          <Embers />
        </group>
      )}

      <HeroModel heroId={heroId} name={playerName} isSelf showName={false} position={[0, 0, 0]} rotationY={0} moving={false} />
      {victory && <Crown />}
      <OrbitCamera />
    </GameCanvas>
  );
}
