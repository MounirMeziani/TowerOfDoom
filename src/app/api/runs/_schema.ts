// Validation for POST /api/runs. Pure (no server-only imports) so it can be unit-tested.
import { z } from "zod";
import { HEROES } from "@/lib/characters";
import {
  BOSS_FLOORS,
  BOSS_PASS_BONUS,
  BOSS_POINTS_PER_A_POINT,
  POINTS_CORRECT,
  SPEED_BONUS_MAX,
  STARTING_HEARTS,
  STREAK_BONUS_CAP,
  TOTAL_FLOORS,
  VICTORY_BONUS_PER_HEART,
} from "@/lib/game/constants";
import { plannedModeForFloor } from "@/lib/game/run";
import type { Mode } from "@/lib/types";

// Plausibility checks below reject impossible combinations (doomed with hearts left, a score the
// run could not reach, skewed aStats). They cannot stop a forged-but-possible run such as a
// 3-heart victory at the maximum score: there is no server-side game state to check against.

const HERO_IDS = new Set(HEROES.map((h) => h.id));
// Only victories need a floor: 12 floors including two typed, judged boss answers realistically
// take well over 30s, but a player can legitimately lose 3 hearts much faster.
const MIN_VICTORY_DURATION_MS = 30_000;
const MAX_DURATION_MS = 2 * 60 * 60 * 1000;

// Each floor adds 1 to the total of both A's of its mode, so an A's total is at most the number of
// floors in its mode (6: five regular floors + one boss).
const FLOORS_PER_MODE: Record<Mode, number> = { giving: 0, receiving: 0 };
for (let n = 1; n <= TOTAL_FLOORS; n++) FLOORS_PER_MODE[plannedModeForFloor(n).mode]++;
const MAX_A_TOTAL = Math.max(FLOORS_PER_MODE.giving, FLOORS_PER_MODE.receiving);

const isBossFloor = (n: number) => n in BOSS_FLOORS;
const REGULAR_FLOOR_MAX = POINTS_CORRECT + STREAK_BONUS_CAP + SPEED_BONUS_MAX; // 250
const BOSS_A_POINTS_MAX = 4 * BOSS_POINTS_PER_A_POINT; // 300
const BOSS_FLOOR_MAX = BOSS_A_POINTS_MAX + BOSS_PASS_BONUS; // 400

/** Highest score a run with this outcome / floors / hearts could possibly reach. */
export function maxScoreFor(r: { floorsCleared: number; heartsLeft: number; outcome: "victory" | "doomed" }): number {
  let max = 0;
  for (let n = 1; n <= r.floorsCleared; n++) max += isBossFloor(n) ? BOSS_FLOOR_MAX : REGULAR_FLOOR_MAX;
  if (r.outcome === "doomed") {
    // A failed boss still keeps its A points (no pass bonus); a failed regular floor scores 0.
    const fatal = r.floorsCleared + 1;
    if (fatal <= TOTAL_FLOORS && isBossFloor(fatal)) max += BOSS_A_POINTS_MAX;
  } else {
    max += VICTORY_BONUS_PER_HEART * r.heartsLeft;
  }
  return max;
}

const AStat = z
  .object({
    correct: z.int().min(0).max(MAX_A_TOTAL),
    total: z.int().min(0).max(MAX_A_TOTAL),
  })
  .refine((s) => s.correct <= s.total, { message: "aStats: correct cannot exceed total." });

export const RunSchema = z
  .object({
    playerName: z
      .string()
      .transform((v) => v.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/\s+/g, " ").trim())
      .pipe(z.string().min(1, "Player name is required.").max(24, "Player name must be 24 characters or fewer.")),
    playerId: z.string().trim().min(1).max(64).optional(),
    heroId: z.string().refine((id) => HERO_IDS.has(id), { message: "Unknown hero." }),
    sessionCode: z.string().max(32).nullable().optional(),
    score: z.number().refine(Number.isFinite, { message: "Invalid score." }),
    floorsCleared: z.int().min(0).max(TOTAL_FLOORS),
    totalFloors: z.literal(TOTAL_FLOORS),
    heartsLeft: z.int().min(0).max(STARTING_HEARTS),
    durationMs: z
      .number()
      .min(0, "Invalid duration.")
      .max(MAX_DURATION_MS, "That climb took too long to record."),
    outcome: z.enum(["victory", "doomed"]),
    aStats: z.object({
      assist: AStat,
      actionable: AStat,
      appreciate: AStat,
      acceptOrDecline: AStat,
    }),
  })
  .refine((r) => r.outcome !== "victory" || (r.floorsCleared === r.totalFloors && r.heartsLeft >= 1), {
    message: "A victory means clearing every floor with at least one heart left.",
  })
  .refine((r) => r.outcome !== "doomed" || (r.heartsLeft === 0 && r.floorsCleared < TOTAL_FLOORS), {
    message: "A doomed run ends with no hearts left.",
  })
  .refine((r) => r.outcome !== "victory" || r.durationMs >= MIN_VICTORY_DURATION_MS, {
    message: "That climb was impossibly fast.",
    path: ["durationMs"],
  })
  .refine((r) => Math.round(r.score) <= maxScoreFor(r), {
    message: "Score is higher than that run could reach.",
    path: ["score"],
  })
  .refine(
    (r) =>
      r.aStats.assist.total === r.aStats.actionable.total && r.aStats.appreciate.total === r.aStats.acceptOrDecline.total,
    { message: "aStats totals are inconsistent.", path: ["aStats"] },
  )
  .refine(
    (r) => {
      const played = Math.min(TOTAL_FLOORS, r.floorsCleared + (r.outcome === "doomed" ? 1 : 0));
      const { assist, actionable, appreciate, acceptOrDecline } = r.aStats;
      return assist.total + actionable.total + appreciate.total + acceptOrDecline.total <= 2 * played;
    },
    { message: "aStats do not match floors played.", path: ["aStats"] },
  );
