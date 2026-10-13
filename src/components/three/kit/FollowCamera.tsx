"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import { dampFactor, type MovementState } from "@/lib/three/movement";
import { usePrefersReducedMotion } from "@/lib/three/support";

type V3 = [number, number, number];
/** Circular occluder on the floor plan: [x, z, radius]. */
export type Occluder = [number, number, number];

const DEFAULT_OFFSET: V3 = [0, 6.2, 8.4];
const DEFAULT_LOOK: V3 = [0, 1, -1.6];
const MIN_CAMERA_Y = 0.8;
/** How far the look target leans toward `lookBias` (0..1). */
const LOOK_BIAS_WEIGHT = 0.55;
/** How far the camera slides sideways toward `lookBias` (fraction of the x gap, capped). */
const POS_BIAS_WEIGHT = 0.35;
const POS_BIAS_MAX = 3;
/** Portrait screens: keep at least this much "virtual aspect" of horizontal view. */
const MIN_PORTRAIT_ASPECT = 0.62;
const MAX_FOV = 72;
/** Occlusion response: margin around occluders, camera rise and back-distance cut at full effect. */
const OCCLUDE_MARGIN = 0.4;
const OCCLUDE_RISE = 2.6;
const OCCLUDE_SHORTEN = 0.38;

const desiredPos = new Vector3();
const desiredLook = new Vector3();

/** Vertical FOV that keeps a minimum horizontal FOV on tall portrait screens. */
function portraitFov(baseFov: number, aspect: number): number {
  if (aspect >= 1) return baseFov;
  const k = Math.max(1, MIN_PORTRAIT_ASPECT / aspect);
  if (k === 1) return baseFov;
  const fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(baseFov / 2)) * k));
  return Math.min(MAX_FOV, fov);
}

/** True when the circle (cx, cz, r) touches the segment a -> b (xz plane, strictly between the ends). */
function blocks(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, r: number): boolean {
  const vx = bx - ax;
  const vz = bz - az;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-6) return false;
  const t = ((cx - ax) * vx + (cz - az) * vz) / len2;
  if (t <= 0 || t >= 1) return false;
  const px = ax + vx * t - cx;
  const pz = az + vz * t - cz;
  return px * px + pz * pz < r * r;
}

/**
 * Smooth third-person camera. With `focus` set it eases into an
 * over-the-shoulder two-shot of the target and that point (e.g. the sensei).
 * Portrait screens widen the FOV (up to 72 deg) and pull the camera back so
 * the room still fits. `lookBias` leans the framing toward a goal (e.g. the
 * stairs); `occluders` lift the camera over pillars between it and the hero.
 * Honours prefers-reduced-motion by locking to the target (no swoops).
 */
export function FollowCamera({
  targetRef,
  offset = DEFAULT_OFFSET,
  lookAtOffset = DEFAULT_LOOK,
  portraitLookAtOffset,
  lerp = 5,
  focus = null,
  lookBias = null,
  occluders,
}: {
  targetRef: MutableRefObject<MovementState>;
  offset?: V3;
  lookAtOffset?: V3;
  /** Look offset used instead of lookAtOffset on portrait screens (aspect < 0.8). */
  portraitLookAtOffset?: V3;
  lerp?: number;
  focus?: V3 | null;
  /** World point the free-roam framing leans toward (about 55%). */
  lookBias?: V3 | null;
  /** Floor-plan circles that should not block the view of the hero. */
  occluders?: Occluder[];
}) {
  const look = useRef(new Vector3());
  const initialized = useRef(false);
  const occlusion = useRef(0); // 0 clear .. 1 fully lifted (smoothed)
  const baseFov = useRef<number | null>(null);
  const camRef = useRef<PerspectiveCamera | null>(null);
  const reduce = usePrefersReducedMotion();

  // Give the canvas its original FOV back if this camera rig unmounts.
  useEffect(
    () => () => {
      const cam = camRef.current;
      const fov = baseFov.current;
      if (cam && fov !== null && cam.fov !== fov) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    },
    [],
  );

  useFrame((state, dt) => {
    const cam = state.camera as PerspectiveCamera;
    const t = targetRef.current;
    const aspect = state.size.width / Math.max(1, state.size.height);

    // Portrait FOV floor (landscape keeps the canvas FOV). updateProjectionMatrix
    // keeps any setViewOffset (ViewShift) applied.
    let widen = 1;
    if (cam.isPerspectiveCamera) {
      camRef.current = cam;
      baseFov.current ??= cam.fov;
      const fov = portraitFov(baseFov.current, aspect);
      widen = Math.max(1, MIN_PORTRAIT_ASPECT / Math.max(0.01, aspect));
      if (Math.abs(cam.fov - fov) > 0.05) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
    }
    // A wider FOV already shows more, so tall phones need less pull-back
    // (1.35 at aspect 0.62 easing to 1.15 once the FOV is widened by 25%).
    const pull =
      aspect < 0.8
        ? 1.35 - 0.2 * Math.min(1, (widen - 1) / 0.25)
        : aspect < 1.2
          ? 1.15
          : 1;

    let rate = lerp;
    if (focus) {
      // Two-shot: camera behind the hero's shoulder, looking at the midpoint.
      let dx = t.x - focus[0];
      let dz = t.z - focus[2];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      const back = 3.2 * pull;
      const side = 2.1 * pull;
      desiredPos.set(t.x + dx * back + dz * side, 2.4 + (pull - 1) * 2, t.z + dz * back - dx * side);
      desiredLook.set((t.x + focus[0]) / 2, Math.max(1.1, focus[1] + 1.1), (t.z + focus[2]) / 2);
      rate = lerp * 0.6;
      occlusion.current = 0;
    } else {
      desiredPos.set(t.x + offset[0] * pull, offset[1] * pull, t.z + offset[2] * pull);
      const lk = aspect < 0.8 && portraitLookAtOffset ? portraitLookAtOffset : lookAtOffset;
      desiredLook.set(t.x + lk[0], lk[1], t.z + lk[2]);
      if (lookBias) {
        desiredLook.x += (lookBias[0] - desiredLook.x) * LOOK_BIAS_WEIGHT;
        desiredLook.z += (lookBias[2] - desiredLook.z) * LOOK_BIAS_WEIGHT;
        desiredPos.x += MathUtils.clamp((lookBias[0] - t.x) * POS_BIAS_WEIGHT, -POS_BIAS_MAX, POS_BIAS_MAX);
      }
      if (occluders && occluders.length > 0) {
        let blocked = false;
        for (const [ox, oz, r] of occluders) {
          if (blocks(desiredPos.x, desiredPos.z, t.x, t.z, ox, oz, r + OCCLUDE_MARGIN)) {
            blocked = true;
            break;
          }
        }
        const target = blocked ? 1 : 0;
        occlusion.current = reduce ? target : occlusion.current + (target - occlusion.current) * dampFactor(4, dt);
        const a = occlusion.current;
        if (a > 0.001) {
          // Shorten the boom toward the hero and lift it over the occluder.
          const keep = 1 - OCCLUDE_SHORTEN * a;
          desiredPos.x = t.x + (desiredPos.x - t.x) * keep;
          desiredPos.z = t.z + (desiredPos.z - t.z) * keep;
          desiredPos.y += OCCLUDE_RISE * a;
        }
      } else {
        occlusion.current = 0;
      }
    }
    desiredPos.y = Math.max(MIN_CAMERA_Y, desiredPos.y);

    // Snap on first frame, after teleports, and always under reduced motion.
    if (reduce || !initialized.current || cam.position.distanceToSquared(desiredPos) > 14 * 14) {
      cam.position.copy(desiredPos);
      look.current.copy(desiredLook);
      initialized.current = true;
    } else {
      const k = dampFactor(rate, dt);
      cam.position.lerp(desiredPos, k);
      look.current.lerp(desiredLook, k);
    }
    if (cam.position.y < MIN_CAMERA_Y) cam.position.y = MIN_CAMERA_Y;
    cam.lookAt(look.current);
  });

  return null;
}
