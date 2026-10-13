"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import {
  ARRIVE_RADIUS,
  MAX_SPEED,
  PLAYER_RADIUS,
  clamp,
  dampAngle,
  dampFactor,
  reachableTarget,
  resolveCollisions,
  steerAround,
  type Bounds,
  type MovementState,
  type Obstacle,
} from "@/lib/three/movement";

export interface MovementOptions {
  bounds: Bounds;
  obstacles?: Obstacle[];
  speed?: number;
  start: [number, number];
  enabled: boolean;
}

export interface MovementController {
  /** Live position/facing, mutated every frame by <MovementDriver>. */
  stateRef: MutableRefObject<MovementState>;
  /**
   * Walk to a point (clamped into bounds, pushed out of obstacles). Manual
   * input cancels it. onArrive fires within ARRIVE_RADIUS, or when the hero
   * is blocked and cannot get closer.
   */
  walkTo(x: number, z: number, onArrive?: () => void): void;
  /** Cancel any walkTo target and brake. */
  stop(): void;
  /** Jump to a point instantly (no collision, no animation). */
  teleport(x: number, z: number, rotY?: number): void;
  /** Disabling stops the hero instantly and drops any walkTo target. */
  setEnabled(b: boolean): void;
  /**
   * Analog input in world axes, |v| <= 1: x = right, z = toward the camera
   * (screen down). The joystick writes here; keyboard input is added on top.
   */
  inputRef: MutableRefObject<{ x: number; z: number }>;
  /** Extra: write the analog input vector (what the joystick calls). */
  setInput(x: number, z: number): void;
  /** Extra: current enabled flag (non-reactive). */
  isEnabled(): boolean;
  /** Extra: advance the simulation; called by <MovementDriver> each frame. */
  step(dt: number): void;
}

interface Config {
  bounds: Bounds;
  obstacles: readonly Obstacle[];
  speed: number;
}

type InternalController = MovementController & {
  configure(c: Config): void;
  setKey(key: string, down: boolean): boolean;
  clearKeys(): void;
};

const KEY_DIRS: Record<string, [number, number]> = {
  w: [0, -1], z: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], q: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

function createController(opts: MovementOptions): InternalController {
  const stateRef: MutableRefObject<MovementState> = {
    current: { x: opts.start[0], z: opts.start[1], rotY: Math.PI, moving: false },
  };
  const inputRef: MutableRefObject<{ x: number; z: number }> = { current: { x: 0, z: 0 } };
  let config: Config = { bounds: opts.bounds, obstacles: opts.obstacles ?? [], speed: opts.speed ?? MAX_SPEED };
  let enabled = opts.enabled;
  let target: { x: number; z: number; onArrive?: () => void } | null = null;
  let stuckFor = 0;
  const vel = { x: 0, z: 0 };
  const keys = new Set<string>();

  const halt = () => {
    vel.x = 0;
    vel.z = 0;
    stateRef.current.moving = false;
  };

  const arrive = () => {
    const cb = target?.onArrive;
    target = null;
    stuckFor = 0;
    cb?.();
  };

  return {
    stateRef,
    inputRef,
    configure(c) {
      config = c;
    },
    walkTo(x, z, onArrive) {
      const s = stateRef.current;
      const [tx, tz] = reachableTarget(x, z, s, config.bounds, config.obstacles);
      target = { x: tx, z: tz, onArrive };
      stuckFor = 0;
    },
    stop() {
      target = null;
      stuckFor = 0;
    },
    teleport(x, z, rotY) {
      const s = stateRef.current;
      s.x = x;
      s.z = z;
      if (rotY !== undefined) s.rotY = rotY;
      target = null;
      stuckFor = 0;
      halt();
    },
    setEnabled(b) {
      enabled = b;
      if (!b) {
        target = null;
        stuckFor = 0;
        halt();
      }
    },
    isEnabled: () => enabled,
    setInput(x, z) {
      inputRef.current = { x, z };
    },
    setKey(key, down) {
      if (!KEY_DIRS[key]) return false;
      if (down) keys.add(key);
      else keys.delete(key);
      return true;
    },
    clearKeys() {
      keys.clear();
    },
    step(dtRaw) {
      const s = stateRef.current;
      if (!enabled) {
        if (s.moving || vel.x || vel.z) halt();
        return;
      }
      const dt = clamp(dtRaw, 0, 0.05);
      const { bounds, obstacles, speed } = config;

      let kx = 0;
      let kz = 0;
      for (const k of keys) {
        kx += KEY_DIRS[k][0];
        kz += KEY_DIRS[k][1];
      }
      const kl = Math.hypot(kx, kz);
      if (kl > 0) { kx /= kl; kz /= kl; }
      const ix = inputRef.current.x + kx;
      const iz = inputRef.current.z + kz;
      const il = Math.hypot(ix, iz);

      let dx = 0;
      let dz = 0;
      let wantSpeed = 0;
      if (il > 0.12) {
        target = null; // manual control wins over walkTo
        const m = Math.min(1, il);
        wantSpeed = m * speed;
        dx = (ix / il) * wantSpeed;
        dz = (iz / il) * wantSpeed;
      } else if (target) {
        const tx = target.x - s.x;
        const tz = target.z - s.z;
        const dist = Math.hypot(tx, tz);
        if (dist <= ARRIVE_RADIUS) {
          arrive();
        } else {
          const [ux, uz] = steerAround(s.x, s.z, tx / dist, tz / dist, dist, obstacles);
          wantSpeed = speed * clamp(dist / 1.2, 0.45, 1);
          dx = ux * wantSpeed;
          dz = uz * wantSpeed;
        }
      }

      const k = dampFactor(wantSpeed > 0 ? 12 : 16, dt);
      vel.x += (dx - vel.x) * k;
      vel.z += (dz - vel.z) * k;
      if (wantSpeed === 0 && Math.hypot(vel.x, vel.z) < 0.02) {
        vel.x = 0;
        vel.z = 0;
      }

      const px = s.x;
      const pz = s.z;
      const pos = { x: s.x + vel.x * dt, z: s.z + vel.z * dt };
      resolveCollisions(pos, vel, bounds, obstacles, PLAYER_RADIUS);
      s.x = pos.x;
      s.z = pos.z;

      // A walkTo that cannot make progress (wall, crowd) ends where it is.
      if (target && wantSpeed > 0) {
        const moved = Math.hypot(s.x - px, s.z - pz);
        stuckFor = moved < wantSpeed * dt * 0.2 ? stuckFor + dt : Math.max(0, stuckFor - dt);
        if (stuckFor > 0.6) arrive();
      }

      const sp = Math.hypot(vel.x, vel.z);
      s.moving = sp > 0.35;
      if (sp > 0.15) s.rotY = dampAngle(s.rotY, Math.atan2(vel.x, vel.z), dampFactor(14, dt));
    },
  };
}

function isEditable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Owns a hero's movement state. Keyboard (WASD / ZQSD / arrows) is wired
 * here; pair with <MovementDriver> inside the Canvas to integrate per frame.
 */
export function useMovementController(opts: MovementOptions): MovementController {
  const [ctrl] = useState(() => createController(opts));
  const { bounds, obstacles, speed, enabled } = opts;

  useEffect(() => {
    ctrl.configure({ bounds, obstacles: obstacles ?? [], speed: speed ?? MAX_SPEED });
  }, [ctrl, bounds, obstacles, speed]);

  useEffect(() => {
    ctrl.setEnabled(enabled);
  }, [ctrl, enabled]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
      const key = e.key.toLowerCase();
      if (ctrl.setKey(key, true) && ctrl.isEnabled() && key.startsWith("arrow")) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => {
      ctrl.setKey(e.key.toLowerCase(), false);
    };
    const onBlur = () => ctrl.clearKeys();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      ctrl.clearKeys();
    };
  }, [ctrl]);

  return ctrl;
}
