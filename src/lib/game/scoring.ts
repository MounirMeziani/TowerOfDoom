// Pure scoring helpers. All numbers come from ./constants.
import { MODE_AS, type AKey, type AStats, type Choice, type Floor, type JudgeResult } from "@/lib/types";
import {
  BOSS_PASS_BONUS,
  BOSS_POINTS_PER_A_POINT,
  POINTS_CORRECT,
  SPEED_BONUS_MAX,
  SPEED_BONUS_WINDOW_MS,
  STREAK_BONUS_CAP,
  STREAK_BONUS_STEP,
  VICTORY_BONUS_PER_HEART,
} from "./constants";

export interface RegularPoints {
  base: number;
  streak: number;
  speed: number;
  total: number;
}

export interface BossPoints {
  aPoints: number;
  pass: number;
  total: number;
}

export function emptyAStats(): AStats {
  return {
    assist: { correct: 0, total: 0 },
    actionable: { correct: 0, total: 0 },
    appreciate: { correct: 0, total: 0 },
    acceptOrDecline: { correct: 0, total: 0 },
  };
}

export function streakBonus(streak: number): number {
  return Math.min(STREAK_BONUS_CAP, Math.max(0, streak - 1) * STREAK_BONUS_STEP);
}

export function speedBonus(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  if (t >= SPEED_BONUS_WINDOW_MS) return 0;
  return Math.round(SPEED_BONUS_MAX * (1 - t / SPEED_BONUS_WINDOW_MS));
}

/**
 * Points for a regular floor. `streak` is the consecutive-correct count INCLUDING this answer
 * (1 = first correct in a row -> no streak bonus; 2 -> +25; ... capped at +100).
 */
export function scoreRegular({ correct, streak, elapsedMs }: { correct: boolean; streak: number; elapsedMs: number }): RegularPoints {
  if (!correct) return { base: 0, streak: 0, speed: 0, total: 0 };
  const base = POINTS_CORRECT;
  const s = streakBonus(streak);
  const speed = speedBonus(elapsedMs);
  return { base, streak: s, speed, total: base + s + speed };
}

export function scoreBoss(result: JudgeResult | null): BossPoints {
  if (!result) return { aPoints: 0, pass: 0, total: 0 };
  let sum = 0;
  for (const v of Object.values(result.scores)) {
    const n = typeof v === "number" ? Math.min(2, Math.max(0, Math.round(v))) : 0;
    sum += n;
  }
  const aPoints = Math.min(4, sum) * BOSS_POINTS_PER_A_POINT;
  const pass = result.passed ? BOSS_PASS_BONUS : 0;
  return { aPoints, pass, total: aPoints + pass };
}

export function victoryBonus(hearts: number): number {
  return Math.max(0, hearts) * VICTORY_BONUS_PER_HEART;
}

export type AStatsOutcome = Choice | JudgeResult | "timeout" | null;

function isChoice(o: Choice | JudgeResult): o is Choice {
  return "misses" in o && Array.isArray((o as Choice).misses);
}

/**
 * Returns a new AStats after one floor.
 * Regular: each of the mode's two A's total+1; correct+1 unless the chosen choice lists it in `misses` (timeout = no correct).
 * Boss: each A total+1; correct+1 if its judge score >= 1 (timeout / null = no correct).
 */
export function applyAStats(stats: AStats, floor: Floor, outcome: AStatsOutcome): AStats {
  const next: AStats = {
    assist: { ...stats.assist },
    actionable: { ...stats.actionable },
    appreciate: { ...stats.appreciate },
    acceptOrDecline: { ...stats.acceptOrDecline },
  };
  for (const a of MODE_AS[floor.mode] as readonly AKey[]) {
    next[a].total += 1;
    if (outcome === null || outcome === "timeout") continue;
    let ok: boolean;
    if (isChoice(outcome)) ok = !outcome.misses.includes(a);
    else ok = (outcome.scores[a] ?? 0) >= 1;
    if (ok) next[a].correct += 1;
  }
  return next;
}

/** Mastery ratio 0..1 (null when the A was never tested). */
export function mastery(stats: AStats, a: AKey): number | null {
  const s = stats[a];
  return s.total > 0 ? s.correct / s.total : null;
}

/** The weakest tested A (lowest ratio; ties -> contract order). Null if nothing tested. */
export function weakestA(stats: AStats): AKey | null {
  let worst: AKey | null = null;
  let worstRatio = Infinity;
  for (const a of ["assist", "actionable", "appreciate", "acceptOrDecline"] as const) {
    const r = mastery(stats, a);
    if (r === null) continue;
    if (r < worstRatio) {
      worst = a;
      worstRatio = r;
    }
  }
  return worst;
}
