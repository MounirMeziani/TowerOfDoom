// Run: node --test src/components/climb3d/climbFlow.test.ts   (Node 23+ strips TypeScript types natively)
// Verifies the 3D climb only starts the engine's floor clock when the question opens.
import assert from "node:assert/strict";
import { test } from "node:test";

import type * as Flow from "./climbFlow";
import type * as Engine from "../../lib/game/engine";

const flow = (await import(new URL("./climbFlow.ts", import.meta.url).href)) as typeof Flow;

// The engine imports through the "@/" alias, which plain Node can't resolve; skip those tests if so.
let engine: typeof Engine | null = null;
try {
  engine = (await import(new URL("../../lib/game/engine.ts", import.meta.url).href)) as typeof Engine;
} catch {
  engine = null;
}

const snap = (status: Engine.GameStatus, index: number, floorCount = 12) => ({ status, index, floorCount });

test("solo intro starts at the entrance, sessions walk straight in", () => {
  assert.deepEqual(flow.initialClimbView(false), { index: 0, phase: "entrance" });
  assert.deepEqual(flow.initialClimbView(true), { index: 0, phase: "explore" });
  assert.deepEqual(flow.reconcileClimbView({ index: 0, phase: "entrance" }, snap("intro", 0), true), { index: 0, phase: "explore" });
});

test("walking floor 1 keeps the engine in intro until the sensei talks", () => {
  const v = { index: 0, phase: "explore" as const };
  assert.deepEqual(flow.reconcileClimbView(v, snap("intro", 0), false), v);
  assert.equal(flow.openQuestionAction(v, snap("intro", 0)), null);
  assert.equal(flow.openQuestionAction({ index: 0, phase: "talk" }, snap("intro", 0)), "START");
});

test("walking floor N+1 keeps the engine in the floor N reveal until the sensei talks", () => {
  const v = { index: 3, phase: "explore" as const };
  assert.deepEqual(flow.reconcileClimbView(v, snap("reveal", 2), false), v);
  assert.equal(flow.openQuestionAction({ index: 3, phase: "talk" }, snap("reveal", 2)), "NEXT");
  // A stale talk on the wrong floor never dispatches.
  assert.equal(flow.openQuestionAction({ index: 5, phase: "talk" }, snap("reveal", 2)), null);
});

test("engine wins: an open question or a stray view snaps to engaged", () => {
  assert.deepEqual(flow.reconcileClimbView({ index: 0, phase: "explore" }, snap("floor", 4), false), { index: 4, phase: "engaged" });
  assert.deepEqual(flow.reconcileClimbView({ index: 9, phase: "explore" }, snap("reveal", 4), false), { index: 4, phase: "engaged" });
  assert.deepEqual(flow.reconcileClimbView({ index: 4, phase: "stairs" }, snap("reveal", 4), false), { index: 4, phase: "stairs" });
  // No floor after the last one.
  assert.deepEqual(flow.reconcileClimbView({ index: 12, phase: "explore" }, snap("reveal", 11), false), { index: 11, phase: "engaged" });
});

test("reveal ends the run when doomed or on the last floor", () => {
  assert.equal(flow.revealEndsRun(snap("reveal", 3), 0), true);
  assert.equal(flow.revealEndsRun(snap("reveal", 11), 2), true);
  assert.equal(flow.revealEndsRun(snap("reveal", 3), 2), false);
});

test("lava level and cleared floors", () => {
  assert.equal(flow.lavaLevelFor(3, 3), 0);
  assert.equal(flow.lavaLevelFor(0, 3), 1);
  assert.equal(flow.clearedFor({ index: 2, phase: "engaged" }, snap("reveal", 2)), 3);
  assert.equal(flow.clearedFor({ index: 3, phase: "explore" }, snap("reveal", 2)), 3);
});

test("walking time never counts: the floor clock starts at the deferred dispatch", { skip: engine === null }, () => {
  const e = engine!;
  const floors = [
    { id: "f1", kind: "choose", mode: "giving", department: "", villain: { name: "", emoji: "", title: "", taunt: "" }, setup: "", prompt: "", choices: [{ id: "a", text: "", correct: true, hits: [], misses: [], explanation: "" }] },
    { id: "f2", kind: "choose", mode: "receiving", department: "", villain: { name: "", emoji: "", title: "", taunt: "" }, setup: "", prompt: "", choices: [{ id: "a", text: "", correct: true, hits: [], misses: [], explanation: "" }] },
  ] as unknown as Engine.GameState["floors"];
  let s = e.initGame(floors);
  // Player walks for 20s, then the question opens at t=20_000.
  s = e.gameReducer(s, { type: "START", now: 20_000 });
  assert.equal(s.floorStartedAt, 20_000);
  s = e.gameReducer(s, { type: "ANSWER", choiceId: "a", now: 21_000 });
  const r1 = e.lastResult(s)!;
  assert.equal(r1.elapsedMs, 1_000);
  // Reveal, stairs, walk for 30s, then the next question opens.
  s = e.gameReducer(s, { type: "NEXT", now: 60_000 });
  assert.equal(s.floorStartedAt, 60_000);
  s = e.gameReducer(s, { type: "ANSWER", choiceId: "a", now: 62_000 });
  assert.equal(e.lastResult(s)!.elapsedMs, 2_000);
});
