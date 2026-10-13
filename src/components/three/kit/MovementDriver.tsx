"use client";

import { useFrame } from "@react-three/fiber";
import type { MovementState } from "@/lib/three/movement";
import type { MovementController } from "./useMovementController";

/** Integrates a MovementController every frame. Place inside <Canvas>. */
export function MovementDriver({
  ctrl,
  onUpdate,
}: {
  ctrl: MovementController;
  onUpdate?: (s: MovementState) => void;
}) {
  useFrame((_, dt) => {
    ctrl.step(dt);
    onUpdate?.(ctrl.stateRef.current);
  });
  return null;
}
