// Builds one 12-floor run from the content pools. Pure + seedable (pass an rng for tests).
import type { BossFloor, Floor, Mode, RegularFloor } from "@/lib/types";
import { BOSS_FLOORS, TOTAL_FLOORS } from "./constants";
import { pickOne, shuffle, type Rng } from "./rng";

const BOSS_SLOTS = BOSS_FLOORS as Readonly<Record<number, Mode>>;

/** Mode of the floor at 1-based `floorNumber` in a full run (boss floors return their boss mode). */
export function plannedModeForFloor(floorNumber: number): { kind: "boss" | "regular"; mode: Mode } {
  const bossMode = BOSS_SLOTS[floorNumber];
  if (bossMode) return { kind: "boss", mode: bossMode };
  let regularIndex = 0;
  for (let n = 1; n < floorNumber; n++) if (!BOSS_SLOTS[n]) regularIndex++;
  return { kind: "regular", mode: regularIndex % 2 === 0 ? "giving" : "receiving" };
}

/** Choose `count` floors from `pool`: random order, repeats only when the pool is too small, >= 1 spot when available. */
function pickRegular(pool: readonly RegularFloor[], count: number, rng: Rng): RegularFloor[] {
  if (pool.length === 0 || count <= 0) return [];
  const picks: RegularFloor[] = [];
  while (picks.length < count) {
    const round = shuffle(pool, rng);
    for (const f of round) {
      if (picks.length >= count) break;
      picks.push(f);
    }
  }
  const hasSpot = picks.some((f) => f.kind === "spot");
  if (!hasSpot) {
    const spots = pool.filter((f) => f.kind === "spot");
    const spot = pickOne(spots, rng);
    if (spot) {
      // Replace a random pick so the spot floor doesn't always land last.
      picks[Math.floor(rng() * picks.length)] = spot;
    }
  }
  return picks;
}

function withShuffledChoices(floor: RegularFloor, rng: Rng): RegularFloor {
  return { ...floor, choices: shuffle(floor.choices, rng) };
}

/**
 * Returns up to TOTAL_FLOORS floors: regular floors alternate giving/receiving (starting with giving),
 * bosses sit at the BOSS_FLOORS slots. Small pools are handled gracefully: repeats are allowed, a missing
 * mode borrows from the other mode, and slots with no content at all are skipped (fewer floors).
 */
export function buildRun(
  pool: readonly RegularFloor[],
  bosses: readonly BossFloor[],
  rng: Rng = Math.random,
): Floor[] {
  const validPool = pool.filter((f) => Array.isArray(f.choices) && f.choices.length > 0);
  const byMode: Record<Mode, RegularFloor[]> = {
    giving: validPool.filter((f) => f.mode === "giving"),
    receiving: validPool.filter((f) => f.mode === "receiving"),
  };

  const slots = Array.from({ length: TOTAL_FLOORS }, (_, i) => plannedModeForFloor(i + 1));
  const need: Record<Mode, number> = { giving: 0, receiving: 0 };
  for (const s of slots) if (s.kind === "regular") need[s.mode]++;

  const sourceFor = (mode: Mode): RegularFloor[] => {
    if (byMode[mode].length > 0) return byMode[mode];
    return validPool; // borrow from the other mode rather than crash
  };
  const queues: Record<Mode, RegularFloor[]> = {
    giving: pickRegular(sourceFor("giving"), need.giving, rng),
    receiving: pickRegular(sourceFor("receiving"), need.receiving, rng),
  };

  const usedBossIds = new Set<string>();
  const pickBoss = (mode: Mode): BossFloor | undefined => {
    const fresh = bosses.filter((b) => !usedBossIds.has(b.id));
    const candidates = fresh.filter((b) => b.mode === mode);
    const boss = pickOne(candidates, rng) ?? pickOne(fresh, rng) ?? pickOne(bosses, rng);
    if (boss) usedBossIds.add(boss.id);
    return boss;
  };

  const floors: Floor[] = [];
  for (const slot of slots) {
    if (slot.kind === "boss") {
      const boss = pickBoss(slot.mode);
      if (boss) floors.push(boss);
    } else {
      const next = queues[slot.mode].shift();
      if (next) floors.push(withShuffledChoices(next, rng));
    }
  }
  return floors;
}
