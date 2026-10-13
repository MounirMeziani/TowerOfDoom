/**
 * Pure movement math shared by the 3D kit. No three.js / React imports so it
 * can be unit-tested and imported anywhere.
 *
 * World convention: y is up, the ground is the XZ plane. A model with
 * rotY = 0 faces +Z; its facing direction is (sin rotY, cos rotY).
 */

export type MovementState = { x: number; z: number; rotY: number; moving: boolean };
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Obstacle = { x: number; z: number; r: number };

/** Collision radius of a walking hero. */
export const PLAYER_RADIUS = 0.35;
/** Default max walking speed (units / second). */
export const MAX_SPEED = 4.5;
/** walkTo() calls onArrive once the hero is this close to the target. */
export const ARRIVE_RADIUS = 0.35;

type Vec = { x: number; z: number };

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Clamp a point so it lies inside the bounds (bounds = where a hero's centre may go). */
export function clampToBounds(x: number, z: number, b: Bounds): [number, number] {
  return [clamp(x, b.minX, b.maxX), clamp(z, b.minZ, b.maxZ)];
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Move `current` toward `target` by fraction k (0..1) along the shortest arc. */
export function dampAngle(current: number, target: number, k: number): number {
  return current + angleDelta(current, target) * k;
}

/** Frame-rate independent smoothing factor for exponential damping. */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/**
 * Push `pos` out of bounds/obstacles and remove the velocity component that
 * points into whatever it hit, so the hero slides along walls and circles.
 * Mutates pos and vel.
 */
export function resolveCollisions(
  pos: Vec,
  vel: Vec,
  bounds: Bounds,
  obstacles: readonly Obstacle[],
  radius = PLAYER_RADIUS,
): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const minD = o.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD) continue;
      const d = Math.sqrt(d2);
      // Exactly on the centre: push toward +X so we never divide by zero.
      const nx = d > 1e-5 ? dx / d : 1;
      const nz = d > 1e-5 ? dz / d : 0;
      pos.x = o.x + nx * minD;
      pos.z = o.z + nz * minD;
      const into = vel.x * nx + vel.z * nz;
      if (into < 0) {
        vel.x -= into * nx;
        vel.z -= into * nz;
      }
    }
  }
  if (pos.x < bounds.minX) { pos.x = bounds.minX; if (vel.x < 0) vel.x = 0; }
  if (pos.x > bounds.maxX) { pos.x = bounds.maxX; if (vel.x > 0) vel.x = 0; }
  if (pos.z < bounds.minZ) { pos.z = bounds.minZ; if (vel.z < 0) vel.z = 0; }
  if (pos.z > bounds.maxZ) { pos.z = bounds.maxZ; if (vel.z > 0) vel.z = 0; }
}

/**
 * If a walk target sits inside an obstacle (e.g. walkTo(SENSEI_POS)), move it
 * to the obstacle's edge on the side facing `from`, so it is reachable.
 */
export function reachableTarget(
  tx: number,
  tz: number,
  from: Vec,
  bounds: Bounds,
  obstacles: readonly Obstacle[],
  radius = PLAYER_RADIUS,
): [number, number] {
  let x = tx;
  let z = tz;
  for (const o of obstacles) {
    const minD = o.r + radius + 0.05;
    const dx = x - o.x;
    const dz = z - o.z;
    if (dx * dx + dz * dz >= minD * minD) continue;
    let nx = from.x - o.x;
    let nz = from.z - o.z;
    const l = Math.hypot(nx, nz);
    if (l < 1e-5) { nx = 0; nz = 1; } else { nx /= l; nz /= l; }
    x = o.x + nx * minD;
    z = o.z + nz * minD;
  }
  return clampToBounds(x, z, bounds);
}

/**
 * Light obstacle avoidance for walkTo: if a circle blocks the straight path
 * ahead, bend the heading sideways around it. Returns a unit direction.
 */
export function steerAround(
  px: number,
  pz: number,
  ux: number,
  uz: number,
  dist: number,
  obstacles: readonly Obstacle[],
  radius = PLAYER_RADIUS,
): [number, number] {
  const look = Math.min(dist, 2.5);
  let sx = 0;
  let sz = 0;
  for (const o of obstacles) {
    const ox = o.x - px;
    const oz = o.z - pz;
    const along = ox * ux + oz * uz; // projection of obstacle onto heading
    if (along <= 0 || along > look + o.r) continue;
    // Signed lateral offset of the obstacle along p = (uz, -ux).
    const side = ox * uz - oz * ux;
    const clear = o.r + radius + 0.15;
    if (Math.abs(side) >= clear) continue;
    const w = (1 - Math.abs(side) / clear) * (1 - along / (look + o.r + 1e-3));
    // Steer along -p when the obstacle is on the +p side, and vice versa.
    const away = side >= 0 ? -1 : 1;
    sx += uz * away * w * 1.6;
    sz += -ux * away * w * 1.6;
  }
  if (sx === 0 && sz === 0) return [ux, uz];
  const nx = ux + sx;
  const nz = uz + sz;
  const l = Math.hypot(nx, nz) || 1;
  return [nx / l, nz / l];
}
