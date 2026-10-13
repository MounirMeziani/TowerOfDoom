import type { Bounds, Obstacle } from "@/lib/three/movement";

/*
 * World layout constants (y is up, the ground is y = 0, "back" of a room is -z, the camera
 * normally sits at +z looking toward -z).
 */

// ------------------------------------------------------------------ LOBBY (26 x 22 hall)

export const LOBBY_SIZE = { w: 26, d: 22 } as const;

export const LOBBY_BOUNDS: Bounds = { minX: -12.2, maxX: 12.2, minZ: -10.1, maxZ: 10.4 };

/** In front of the elevator doors on the back wall. */
export const ELEVATOR_POS: [number, number] = [9, -9.4];

export const LOBBY_PILLARS: Array<[number, number]> = [
  [-6.5, -5],
  [6.5, -5],
  [-6.5, 1],
  [6.5, 1],
  [-6.5, 7],
  [6.5, 7],
];

/** Reception desk (left side, facing +x). */
export const LOBBY_DESK = { x: -9.8, z: -1, len: 4.4 } as const;
export const LOBBY_BENCHES: Array<[number, number]> = [
  [11.2, -2],
  [11.2, 4],
];
export const LOBBY_PLANTS: Array<[number, number]> = [
  [-12, -9.9],
  [12, -9.9],
  [-12, 9.6],
  [12, 9.6],
  [-11.9, 2.6],
  [6.6, -9.9],
];

export const LOBBY_OBSTACLES: Obstacle[] = [
  ...LOBBY_PILLARS.map(([x, z]) => ({ x, z, r: 0.75 })),
  { x: LOBBY_DESK.x, z: LOBBY_DESK.z - 1.5, r: 0.95 },
  { x: LOBBY_DESK.x, z: LOBBY_DESK.z, r: 0.95 },
  { x: LOBBY_DESK.x, z: LOBBY_DESK.z + 1.5, r: 0.95 },
  ...LOBBY_BENCHES.flatMap(([x, z]) => [
    { x, z: z - 0.7, r: 0.6 },
    { x, z: z + 0.7, r: 0.6 },
  ]),
  ...LOBBY_PLANTS.map(([x, z]) => ({ x, z, r: 0.55 })),
];

const SPAWN_CENTER: [number, number] = [0, 3];

/** Spawn points in rings around the lobby center (deterministic, cycles after 20). */
export function lobbySpawn(i: number): [number, number] {
  const n = ((Math.floor(i) % 20) + 20) % 20;
  const inner = n < 8;
  const count = inner ? 8 : 12;
  const k = inner ? n : n - 8;
  const radius = inner ? 3.4 : 5.6;
  const a = (k / count) * Math.PI * 2 + (inner ? 0 : Math.PI / count);
  return [
    Math.round((SPAWN_CENTER[0] + Math.sin(a) * radius) * 100) / 100,
    Math.round((SPAWN_CENTER[1] + Math.cos(a) * radius) * 100) / 100,
  ];
}

/** Stable spawn slot (0..19) from a player id (FNV-1a), so a refresh lands on the same spot. */
export function spawnIndex(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 20;
}

/** The lobby spawn spot for a player id (same on every client: player view and projector). */
export function lobbySpawnFor(id: string): [number, number] {
  return lobbySpawn(spawnIndex(id));
}

// ------------------------------------------------------------------ FLOOR ROOM (14 wide x 18 deep)

export const ROOM_SIZE = { w: 14, d: 18 } as const;

export const ROOM_BOUNDS: Bounds = { minX: -6.3, maxX: 6.3, minZ: -8.4, maxZ: 8.4 };

export const PLAYER_SPAWN: [number, number] = [0, 6.8];
export const SENSEI_POS: [number, number] = [0, -5.6];
export const STAIRS_POS: [number, number] = [5.1, -7.7];
/** Where the floor's villain figure stands (back-left corner, pure flavor). */
export const VILLAIN_POS: [number, number] = [-4.7, -6.8];

export const TALK_RADIUS = 2.4;
export const STAIRS_RADIUS = 1.6;

/** Furniture runs along both side walls between these z values. */
export const ROOM_BAND_Z: [number, number] = [-3.4, 5.4];
export const ROOM_BAND_X = 5.4;

export const ROOM_OBSTACLES: Obstacle[] = [
  { x: SENSEI_POS[0], z: SENSEI_POS[1], r: 0.75 },
  { x: VILLAIN_POS[0], z: VILLAIN_POS[1], r: 1.0 },
  ...[4.5, 2.75, 1.0, -0.75, -2.5].flatMap((z) => [
    { x: -ROOM_BAND_X, z, r: 0.95 },
    { x: ROOM_BAND_X, z, r: 0.95 },
  ]),
];
