"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Mesh, MeshBasicMaterial } from "three";
import type { MovementController } from "./useMovementController";

const EMBER = "#ff6b2c";

/**
 * Invisible ground plane: tap/click to walk there, press-and-drag to steer.
 * Shows a small fading ember ring where you tapped.
 */
export function TapToMove({ ctrl, size = 80 }: { ctrl: MovementController; size?: number }) {
  const marker = useRef<Mesh>(null);
  const markerAge = useRef(1);
  const activePointer = useRef<number | null>(null);

  const go = (e: ThreeEvent<PointerEvent>) => {
    ctrl.walkTo(e.point.x, e.point.z);
    const m = marker.current;
    if (m) {
      m.position.set(e.point.x, 0.03, e.point.z);
      markerAge.current = 0;
    }
  };

  useFrame((_, dt) => {
    const m = marker.current;
    if (!m) return;
    markerAge.current = Math.min(1, markerAge.current + dt * 1.6);
    const a = markerAge.current;
    m.visible = a < 1;
    m.scale.setScalar(0.6 + a * 0.8);
    (m.material as MeshBasicMaterial).opacity = (1 - a) * 0.85;
  });

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.002}
        onPointerDown={(e) => {
          if (e.nativeEvent.pointerType === "mouse" && e.nativeEvent.button !== 0) return;
          if (!ctrl.isEnabled()) return;
          e.stopPropagation();
          activePointer.current = e.pointerId;
          go(e);
        }}
        onPointerMove={(e) => {
          if (activePointer.current !== e.pointerId || !ctrl.isEnabled()) return;
          ctrl.walkTo(e.point.x, e.point.z);
        }}
        onPointerUp={(e) => {
          if (activePointer.current === e.pointerId) activePointer.current = null;
        }}
        onPointerLeave={(e) => {
          if (activePointer.current === e.pointerId) activePointer.current = null;
        }}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <mesh ref={marker} rotation-x={-Math.PI / 2} visible={false} renderOrder={2}>
        <ringGeometry args={[0.28, 0.4, 24]} />
        <meshBasicMaterial color={EMBER} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
