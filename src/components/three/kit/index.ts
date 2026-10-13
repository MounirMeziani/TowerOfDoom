// 3D kit barrel. Everything here assumes a client-only module tree; load
// scenes that use it with next/dynamic({ ssr: false }). Non-3D pages that only
// need useWebGLSupport / useMode2D should import "@/lib/three/support" so the
// three.js bundle is not pulled in.

export { GameCanvas, TowerLoader } from "./GameCanvas";
export { HeroModel, type HeroModelProps } from "./HeroModel";
export { useMovementController, type MovementController, type MovementOptions } from "./useMovementController";
export { MovementDriver } from "./MovementDriver";
export { FollowCamera, type Occluder } from "./FollowCamera";
export { TapToMove } from "./TapToMove";
export { VirtualJoystick } from "./VirtualJoystick";
export { useWebGLSupport, useMode2D, useCoarsePointer, usePrefersReducedMotion } from "@/lib/three/support";
export { setDebug, resetDebug, type TodDebug } from "@/lib/three/debug";
export {
  ARRIVE_RADIUS,
  MAX_SPEED,
  PLAYER_RADIUS,
  type Bounds,
  type MovementState,
  type Obstacle,
} from "@/lib/three/movement";
