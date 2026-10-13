// Pure UI-layer state machine for the 3D climb. The game engine (src/lib/game/engine.ts) is untouched:
// the 3D layer simply waits to dispatch START / NEXT until the player has walked up to the sensei, so
// the engine's floorStartedAt (and the floor timer + speed bonus) begin when the question opens.
//
// No runtime imports: this file runs under `node --test` without a bundler.
import type { GameStatus } from "@/lib/game/engine";

/**
 * entrance   solo intro: the tower lobby with an Enter button
 * entering   elevator ride into floor 1 (short fade)
 * explore    walking around the floor room; the sensei waits with a "!"
 * talk       reached the sensei: movement frozen, speech bubble, camera two-shot (question opens next)
 * engaged    the engine owns the floor: question (status "floor") or reveal (status "reveal")
 * stairs     reveal dismissed: the stairs glow, walk into them
 * transition fade + camera rise to the next floor
 */
export type ClimbPhase = "entrance" | "entering" | "explore" | "talk" | "engaged" | "stairs" | "transition";

export interface ClimbView {
  /** 0-based floor index the player is on in the 3D world. */
  index: number;
  phase: ClimbPhase;
}

export interface EngineSnapshot {
  status: GameStatus;
  index: number;
  floorCount: number;
}

/** How long the sensei greets the player before the question opens. */
export const TALK_MS = 1100;
/** Fade + camera rise between floors. */
export const TRANSITION_MS = 750;
/** Elevator ride from the entrance into floor 1. */
export const ENTERING_MS = 900;

export function initialClimbView(autoStart: boolean): ClimbView {
  return { index: 0, phase: autoStart ? "explore" : "entrance" };
}

/**
 * Brings the UI view in line with the engine (the engine always wins). Handles toggling between 2D
 * and 3D mid-run, "Play again", and the deferred START / NEXT pattern:
 * - engine "intro"  -> the player is at the entrance or walking floor 1 (START not yet dispatched)
 * - engine "floor"  -> question open on engine.index
 * - engine "reveal" -> reveal / stairs on engine.index, or walking engine.index + 1 (NEXT not yet dispatched)
 */
export function reconcileClimbView(view: ClimbView, engine: EngineSnapshot, autoStart: boolean): ClimbView {
  const { status, index, floorCount } = engine;
  switch (status) {
    case "intro": {
      if (view.index !== 0) return initialClimbView(autoStart);
      if (view.phase === "entrance") return autoStart ? { index: 0, phase: "explore" } : view;
      if (view.phase === "entering" || view.phase === "explore" || view.phase === "talk") return view;
      return initialClimbView(autoStart);
    }
    case "floor":
      return view.index === index && view.phase === "engaged" ? view : { index, phase: "engaged" };
    case "reveal": {
      if (view.index === index && (view.phase === "engaged" || view.phase === "stairs" || view.phase === "transition")) {
        return view;
      }
      const hasNext = index + 1 < floorCount;
      if (hasNext && view.index === index + 1 && (view.phase === "explore" || view.phase === "talk")) return view;
      return { index, phase: "engaged" };
    }
    case "finished":
    default:
      return view;
  }
}

/** What opening the question at the sensei must dispatch to the engine (null = nothing to open). */
export function openQuestionAction(view: ClimbView, engine: EngineSnapshot): "START" | "NEXT" | null {
  if (view.phase !== "talk") return null;
  if (engine.status === "intro" && view.index === 0) return "START";
  if (engine.status === "reveal" && view.index === engine.index + 1 && view.index < engine.floorCount) return "NEXT";
  return null;
}

/** After the reveal: true when Next must go straight to the engine (doomed or the last floor). */
export function revealEndsRun(engine: EngineSnapshot, hearts: number): boolean {
  return hearts <= 0 || engine.index >= engine.floorCount - 1;
}

/** Floors resolved before the one in view (drives the HUD tower). */
export function clearedFor(view: ClimbView, engine: EngineSnapshot): number {
  if (engine.status === "reveal" && view.index === engine.index) return engine.index + 1;
  return view.index;
}

/** 0..1 lava height from hearts lost. */
export function lavaLevelFor(hearts: number, maxHearts: number): number {
  if (maxHearts <= 0) return 0;
  return Math.max(0, Math.min(1, (maxHearts - hearts) / maxHearts));
}

export function dist2D(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}
