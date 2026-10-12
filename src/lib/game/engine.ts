// Game state machine (useReducer-friendly, pure: all timestamps arrive via actions).
// intro -> floor -> reveal -> floor ... -> finished (victory | doomed)
import type { AStats, BossFloor, Choice, Floor, JudgeResult, RegularFloor } from "@/lib/types";
import { BOSS_TIME_LIMIT_MS, REGULAR_TIME_LIMIT_MS, STARTING_HEARTS } from "./constants";
import {
  applyAStats,
  emptyAStats,
  scoreBoss,
  scoreRegular,
  victoryBonus,
  type BossPoints,
  type RegularPoints,
} from "./scoring";

export type GameStatus = "intro" | "floor" | "reveal" | "finished";
export type Outcome = "victory" | "doomed";

interface FloorResultBase {
  floorIndex: number;
  floorId: string;
  correct: boolean;
  timedOut: boolean;
  heartLost: boolean;
  elapsedMs: number;
  points: number;
  /** Streak after this floor. */
  streak: number;
}

export interface RegularFloorResult extends FloorResultBase {
  kind: "regular";
  choiceId: string | null;
  breakdown: RegularPoints;
}

export interface BossFloorResult extends FloorResultBase {
  kind: "boss";
  answer: string;
  judge: JudgeResult | null;
  breakdown: BossPoints;
}

export type FloorResult = RegularFloorResult | BossFloorResult;

export interface GameState {
  floors: Floor[];
  index: number;
  hearts: number;
  score: number;
  streak: number;
  bestStreak: number;
  aStats: AStats;
  startedAt: number | null;
  floorStartedAt: number | null;
  finishedAt: number | null;
  history: FloorResult[];
  status: GameStatus;
  outcome: Outcome | null;
  victoryBonus: number;
}

export type GameAction =
  | { type: "START"; now: number }
  | { type: "ANSWER"; choiceId: string; now: number }
  | { type: "TIMEOUT"; now: number }
  | { type: "BOSS_SUBMITTED"; result: JudgeResult; answer?: string; now: number }
  | { type: "NEXT"; now: number }
  /** New run. Pass `floors` for a fresh shuffle (else the same floors are reused); pass `now` to skip the intro. */
  | { type: "RESTART"; floors?: Floor[]; now?: number };

export function initGame(floors: Floor[]): GameState {
  return {
    floors,
    index: 0,
    hearts: STARTING_HEARTS,
    score: 0,
    streak: 0,
    bestStreak: 0,
    aStats: emptyAStats(),
    startedAt: null,
    floorStartedAt: null,
    finishedAt: null,
    history: [],
    status: "intro",
    outcome: null,
    victoryBonus: 0,
  };
}

export function currentFloor(state: GameState): Floor | null {
  return state.floors[state.index] ?? null;
}

export function timeLimitFor(floor: Floor | null): number {
  return floor?.kind === "boss" ? BOSS_TIME_LIMIT_MS : REGULAR_TIME_LIMIT_MS;
}

export function lastResult(state: GameState): FloorResult | null {
  return state.history[state.history.length - 1] ?? null;
}

/** Floors cleared: everything survived (the fatal floor on a doomed run does not count). */
export function floorsCleared(state: GameState): number {
  return Math.max(0, state.history.length - (state.hearts <= 0 ? 1 : 0));
}

export function durationMs(state: GameState): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.finishedAt ?? state.floorStartedAt ?? state.startedAt) - state.startedAt);
}

function start(state: GameState, now: number): GameState {
  if (state.floors.length === 0) {
    return { ...state, status: "finished", outcome: "victory", startedAt: now, floorStartedAt: now, finishedAt: now };
  }
  return { ...state, status: "floor", index: 0, startedAt: now, floorStartedAt: now };
}

function elapsed(state: GameState, now: number): number {
  return Math.max(0, now - (state.floorStartedAt ?? now));
}

function resolveRegular(state: GameState, floor: RegularFloor, choice: Choice | null, now: number): GameState {
  const correct = !!choice?.correct;
  const streak = correct ? state.streak + 1 : 0;
  const ms = elapsed(state, now);
  const breakdown = scoreRegular({ correct, streak, elapsedMs: ms });
  const heartLost = !correct;
  const result: RegularFloorResult = {
    kind: "regular",
    floorIndex: state.index,
    floorId: floor.id,
    choiceId: choice?.id ?? null,
    correct,
    timedOut: choice === null,
    heartLost,
    elapsedMs: ms,
    points: breakdown.total,
    streak,
    breakdown,
  };
  return {
    ...state,
    status: "reveal",
    hearts: heartLost ? Math.max(0, state.hearts - 1) : state.hearts,
    score: state.score + breakdown.total,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    aStats: applyAStats(state.aStats, floor, choice ?? "timeout"),
    history: [...state.history, result],
  };
}

function resolveBoss(state: GameState, floor: BossFloor, judge: JudgeResult | null, answer: string, now: number): GameState {
  const passed = !!judge?.passed;
  const streak = passed ? state.streak + 1 : 0;
  const ms = elapsed(state, now);
  const breakdown = scoreBoss(judge);
  const result: BossFloorResult = {
    kind: "boss",
    floorIndex: state.index,
    floorId: floor.id,
    answer,
    judge,
    correct: passed,
    timedOut: judge === null,
    heartLost: !passed,
    elapsedMs: ms,
    points: breakdown.total,
    streak,
    breakdown,
  };
  return {
    ...state,
    status: "reveal",
    hearts: passed ? state.hearts : Math.max(0, state.hearts - 1),
    score: state.score + breakdown.total,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    aStats: applyAStats(state.aStats, floor, judge ?? "timeout"),
    history: [...state.history, result],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START": {
      if (state.status !== "intro") return state;
      return start(state, action.now);
    }
    case "ANSWER": {
      if (state.status !== "floor") return state;
      const floor = currentFloor(state);
      if (!floor || floor.kind === "boss") return state;
      const choice = floor.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;
      return resolveRegular(state, floor, choice, action.now);
    }
    case "TIMEOUT": {
      if (state.status !== "floor") return state;
      const floor = currentFloor(state);
      if (!floor) return state;
      if (floor.kind === "boss") return resolveBoss(state, floor, null, "", action.now);
      return resolveRegular(state, floor, null, action.now);
    }
    case "BOSS_SUBMITTED": {
      if (state.status !== "floor") return state;
      const floor = currentFloor(state);
      if (!floor || floor.kind !== "boss") return state;
      return resolveBoss(state, floor, action.result, action.answer ?? "", action.now);
    }
    case "NEXT": {
      if (state.status !== "reveal") return state;
      if (state.hearts <= 0) {
        return { ...state, status: "finished", outcome: "doomed", finishedAt: action.now };
      }
      if (state.index >= state.floors.length - 1) {
        const bonus = victoryBonus(state.hearts);
        return {
          ...state,
          status: "finished",
          outcome: "victory",
          victoryBonus: bonus,
          score: state.score + bonus,
          finishedAt: action.now,
        };
      }
      return { ...state, status: "floor", index: state.index + 1, floorStartedAt: action.now };
    }
    case "RESTART": {
      const fresh = initGame(action.floors ?? state.floors);
      return action.now === undefined ? fresh : start(fresh, action.now);
    }
    default:
      return state;
  }
}
