"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useMemo, useReducer, useRef, useState } from "react";
import {
  ENTERING_MS,
  TALK_MS,
  TRANSITION_MS,
  clearedFor,
  initialClimbView,
  openQuestionAction,
  reconcileClimbView,
  revealEndsRun,
  type ClimbView,
} from "@/components/climb3d/climbFlow";
import { SceneBoundary } from "@/components/climb3d/SceneBoundary";
import { SceneLoader } from "@/components/climb3d/SceneLoader";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { BOSS_FLOORS_CONTENT, REGULAR_FLOORS } from "@/content/floors";
import { judgeAnswer } from "@/lib/api";
import { STARTING_HEARTS } from "@/lib/game/constants";
import { currentFloor, floorsCleared, gameReducer, initGame, lastResult, timeLimitFor } from "@/lib/game/engine";
import { fallbackJudge } from "@/lib/game/judge-fallback";
import { buildRun } from "@/lib/game/run";
import { buildRunSubmission, runKeyFor, submitOnce } from "@/lib/game/submit";
import { useLobbyPresence } from "@/lib/lobby";
import { useMode2D, useWebGLSupport } from "@/lib/three/support";
import type { Floor, JudgeResult, LobbyPresence, Mode, Player, SessionStatus } from "@/lib/types";
import { MODE_AS } from "@/lib/types";
import { BossInput } from "./BossInput";
import { ChoiceList } from "./ChoiceList";
import { FinishedScreen } from "./FinishedScreen";
import { FloorHeader } from "./FloorCard";
import { Hud } from "./Hud";
import { IntroScreen } from "./IntroScreen";
import { LavaLayer } from "./LavaLayer";
import { PlayFrame, PlayLoader } from "./PlayFrame";
import { RevealPanel } from "./RevealPanel";

// The 3D scenes are client-only and code-split so three.js never loads for the 2D fallback.
const ClimbScene = dynamic(() => import("@/components/climb3d/ClimbScene"), { ssr: false, loading: () => <SceneLoader /> });
const FinishedBackdrop = dynamic(() => import("@/components/climb3d/FinishedBackdrop"), { ssr: false, loading: () => null });

const TICK_MS = 250;
/** Enter can only dismiss the reveal after it has been on screen this long. */
const REVEAL_MIN_MS = 400;
type BossDraft = { index: number; text: string; judging: boolean; runStartedAt: number | null };
const EMPTY_DRAFT: BossDraft = { index: -1, text: "", judging: false, runStartedAt: null };

function newRun() {
  return buildRun(REGULAR_FLOORS, BOSS_FLOORS_CONTENT);
}

/** Validates an untrusted judge response; anything malformed falls back to the client-side heuristic judge. */
function sanitizeJudge(mode: Mode, answer: string, raw: unknown): JudgeResult {
  if (!raw || typeof raw !== "object") return fallbackJudge(mode, answer);
  const r = raw as Partial<JudgeResult>;
  if (!r.scores || typeof r.scores !== "object" || typeof r.passed !== "boolean") return fallbackJudge(mode, answer);
  const scores: JudgeResult["scores"] = {};
  for (const a of MODE_AS[mode]) {
    const v = Number(r.scores[a] ?? 0);
    scores[a] = (Number.isFinite(v) ? Math.max(0, Math.min(2, Math.round(v))) : 0) as 0 | 1 | 2;
  }
  return {
    scores,
    passed: r.passed,
    feedback: typeof r.feedback === "string" && r.feedback.trim() ? r.feedback : "Judged.",
    source: r.source === "ai" ? "ai" : "heuristic",
  };
}

interface GameProps {
  player: Player;
  /** Session code used for presence + run submission (null = solo). */
  sessionCode: string | null;
  sessionStatus: SessionStatus | null;
  onChangeHero: () => void;
}

export function Game({ player, sessionCode, sessionStatus, onChangeHero }: GameProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const headingId = useId();
  const [state, dispatch] = useReducer(gameReducer, undefined, () => initGame(newRun()));
  const [now, setNow] = useState(0);
  const [boss, setBoss] = useState<BossDraft>(EMPTY_DRAFT);
  const [joinedAt] = useState(() => new Date().toISOString());

  // ---- 2D / 3D --------------------------------------------------------------------------------
  const webgl = useWebGLSupport();
  const [mode2d, setMode2d] = useMode2D();
  const [sceneFailed, setSceneFailed] = useState(false);
  const can3D = webgl === true && !sceneFailed;
  const use3D = can3D && !mode2d;
  const viewToggle = can3D
    ? {
        is3D: use3D,
        onToggle: () => {
          if (use3D) settleBeforeLeaving3D();
          setMode2d(use3D);
        },
      }
    : null;

  const floor = currentFloor(state);
  const result = lastResult(state);
  const limit = timeLimitFor(floor);
  // The draft is tagged with its run so a "Play again" never shows (or auto-submits) a previous run's answer.
  const draftIsCurrent = boss.index === state.index && boss.runStartedAt === state.startedAt;
  const bossText = draftIsCurrent ? boss.text : "";
  const judging = draftIsCurrent && boss.judging;
  const cleared = floorsCleared(state);

  // ---- Session integration -------------------------------------------------------------------
  const autoStart = sessionStatus === "playing";
  // Only redirect from the intro. A finished run must stay put so FinishedScreen shows the result
  // (and offers the round-2 lobby) instead of the run vanishing when the host resets to the lobby.
  const backToLobby = !!sessionCode && sessionStatus === "lobby" && state.status === "intro";

  // ---- 3D floor sub-state (UI layer; the engine is untouched) ----------------------------------
  // In 3D the engine's START / NEXT are deferred until the player reaches the sensei, so the floor
  // timer (floorStartedAt) only starts when the question opens. See climb3d/climbFlow.ts.
  const [baseView, setView] = useState<ClimbView>(() => initialClimbView(autoStart));
  const engineSnap = { status: state.status, index: state.index, floorCount: state.floors.length };
  const view = reconcileClimbView(baseView, engineSnap, autoStart);

  // 2D: a session that is already playing skips the intro.
  useEffect(() => {
    if (!use3D && autoStart && state.status === "intro") dispatch({ type: "START", now: Date.now() });
  }, [use3D, autoStart, state.status]);

  useEffect(() => {
    if (backToLobby && sessionCode) router.replace(`/lobby/${sessionCode}`);
  }, [backToLobby, sessionCode, router]);

  const entered3D = use3D && view.phase !== "entrance";
  const presenceIndex = use3D ? view.index : state.index;
  const me = useMemo<LobbyPresence | null>(() => {
    if (!sessionCode) return null;
    // 2D auto-start: skip the one-render 'lobby' update so only the 'playing' presence message goes out.
    if (state.status === "intro" && autoStart && !entered3D) return null;
    const finished = state.status === "finished";
    return {
      playerId: player.id,
      name: player.name,
      heroId: player.heroId,
      phase: finished ? "finished" : state.status === "intro" && !entered3D ? "lobby" : "playing",
      floor: finished ? cleared : Math.min(presenceIndex + 1, state.floors.length),
      score: state.score,
      hearts: state.hearts,
      joinedAt,
    };
  }, [sessionCode, autoStart, entered3D, player.id, player.name, player.heroId, state.status, presenceIndex, state.floors.length, state.score, state.hearts, cleared, joinedAt]);
  useLobbyPresence(sessionCode, me);

  // ---- Run submission -------------------------------------------------------------------------
  // Fire the save as soon as the run finishes, independent of what is rendered. FinishedScreen reads
  // the same deduped promise for its status display.
  const finished = state.status === "finished";
  const runKey = runKeyFor(player, state);
  const submitRunNow = useEffectEvent(() => {
    submitOnce(runKey, buildRunSubmission(state, player, sessionCode)).catch(() => {
      // FinishedScreen shows the error and offers a retry.
    });
  });
  useEffect(() => {
    if (finished) submitRunNow();
  }, [finished, runKey]);

  // Warn before a tab close / reload mid-run (the run would be lost).
  const midRun = state.status === "floor" || state.status === "reveal";
  useEffect(() => {
    if (!midRun) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [midRun]);

  // ---- Boss submission ------------------------------------------------------------------------
  function submitBoss(submittedAt: number) {
    if (!floor || floor.kind !== "boss" || judging || state.status !== "floor") return;
    const answer = bossText.trim();
    if (!answer) {
      dispatch({ type: "TIMEOUT", now: submittedAt });
      return;
    }
    const index = state.index;
    const runStartedAt = state.startedAt;
    setBoss({ index, text: bossText, judging: true, runStartedAt });
    // judgeAnswer enforces its own 35s deadline (server maxDuration is 30s) and retries a 429 once.
    judgeAnswer({ floorId: floor.id, mode: floor.mode, setup: floor.setup, prompt: floor.prompt, answer, playerId: player.id })
      .then((raw) => sanitizeJudge(floor.mode, answer, raw))
      .catch(() => fallbackJudge(floor.mode, answer))
      .then((judged) => {
        dispatch({ type: "BOSS_SUBMITTED", result: judged, answer, now: submittedAt });
        setBoss((b) => (b.index === index && b.runStartedAt === runStartedAt ? { ...b, judging: false } : b));
      });
  }

  // ---- Timer ----------------------------------------------------------------------------------
  const onTimeUp = useEffectEvent((t: number) => {
    if (state.status !== "floor") return;
    if (floor?.kind === "boss") {
      if (judging) return;
      if (bossText.trim()) submitBoss(t);
      else dispatch({ type: "TIMEOUT", now: t });
    } else {
      dispatch({ type: "TIMEOUT", now: t });
    }
  });

  const timing = state.status === "floor" && state.floorStartedAt !== null && !judging;
  const floorStartedAt = state.floorStartedAt;
  useEffect(() => {
    if (!timing || floorStartedAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t - floorStartedAt >= limit) onTimeUp(t);
    };
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [timing, floorStartedAt, limit]);

  const remainingMs =
    state.status === "floor" && floorStartedAt !== null
      ? Math.max(0, limit - Math.max(0, now - floorStartedAt))
      : null;

  // ---- 3D flow --------------------------------------------------------------------------------
  /** Reached the sensei: freeze, greet, then open the question (TALK_MS later). */
  function onTalk() {
    if (view.phase === "explore") setView({ index: view.index, phase: "talk" });
  }
  /** Walked into the glowing stairs. */
  function onStairs() {
    if (view.phase === "stairs") setView({ index: view.index, phase: "transition" });
  }
  /** Reveal dismissed: the run ends here (doomed / last floor) or the stairs open. */
  function onRevealNext3D() {
    if (state.status !== "reveal") return;
    if (revealEndsRun(engineSnap, state.hearts)) dispatch({ type: "NEXT", now: Date.now() });
    else setView({ index: state.index, phase: "stairs" });
  }
  /** Leaving 3D after the reveal was dismissed: do the deferred NEXT now, as 2D's Next button would. */
  function settleBeforeLeaving3D() {
    if (!use3D || state.status !== "reveal") return;
    const pastReveal =
      (view.index === state.index && (view.phase === "stairs" || view.phase === "transition")) ||
      view.index === state.index + 1;
    if (pastReveal && !revealEndsRun(engineSnap, state.hearts)) {
      dispatch({ type: "NEXT", now: Date.now() });
      setView({ index: state.index + 1, phase: "engaged" }); // keep baseView in step with the engine
    }
  }

  const openQuestion = useEffectEvent(() => {
    const action = openQuestionAction(view, engineSnap);
    if (action) {
      // The engine's floor clock starts NOW, not when the player started walking.
      dispatch({ type: action, now: Date.now() });
      setView({ index: view.index, phase: "engaged" });
    } else if (view.phase === "talk") {
      setView({ index: view.index, phase: "explore" });
    }
  });
  const advanceView = useEffectEvent(() => {
    if (view.phase === "transition") setView({ index: view.index + 1, phase: "explore" });
    else if (view.phase === "entering") setView({ index: 0, phase: "explore" });
  });
  useEffect(() => {
    if (!use3D) return;
    let id: number | undefined;
    if (view.phase === "talk") id = window.setTimeout(() => openQuestion(), TALK_MS);
    else if (view.phase === "transition") id = window.setTimeout(() => advanceView(), TRANSITION_MS);
    else if (view.phase === "entering") id = window.setTimeout(() => advanceView(), ENTERING_MS);
    return () => {
      if (id !== undefined) window.clearTimeout(id);
    };
  }, [use3D, view.phase, view.index]);

  // ---- Keyboard: 1-4 answer, Enter = next ------------------------------------------------------
  // When the reveal opened: a held / double-tapped Enter must not skip straight past it.
  const revealAtRef = useRef(0);
  useEffect(() => {
    if (state.status === "reveal") revealAtRef.current = performance.now();
  }, [state.status, state.index]);
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || target?.isContentEditable) return;
    // Solo 3D entrance: Enter / E walks into the elevator.
    if (use3D && view.phase === "entrance") {
      const key = e.key.toLowerCase();
      if (key === "e" || (key === "enter" && tag !== "BUTTON" && tag !== "A")) {
        e.preventDefault();
        setView({ index: 0, phase: "entering" });
      }
      return;
    }
    if (state.status === "floor" && floor && floor.kind !== "boss") {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= floor.choices.length) {
        e.preventDefault();
        dispatch({ type: "ANSWER", choiceId: floor.choices[n - 1].id, now: Date.now() });
      }
    } else if (state.status === "reveal" && e.key === "Enter") {
      if (tag === "BUTTON" || tag === "A") return; // native activation handles it
      if (performance.now() - revealAtRef.current < REVEAL_MIN_MS) {
        e.preventDefault();
        return;
      }
      if (use3D) {
        // Only while the reveal is on screen (not while walking to the next sensei / the stairs).
        if (view.phase !== "engaged") return;
        e.preventDefault();
        onRevealNext3D();
        return;
      }
      e.preventDefault();
      dispatch({ type: "NEXT", now: Date.now() });
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Scroll to the top on every screen change so phones always start at the question.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [state.status, state.index]);

  function playAgain() {
    setBoss(EMPTY_DRAFT);
    if (use3D) {
      // Back to floor 1's room; START fires when the player reaches the first sensei.
      dispatch({ type: "RESTART", floors: newRun() });
      setView(initialClimbView(true));
    } else {
      dispatch({ type: "RESTART", floors: newRun(), now: Date.now() });
    }
  }

  // ---- Render ---------------------------------------------------------------------------------
  if (backToLobby) return <PlayLoader message="Heading to the lobby" />;

  if (state.status === "finished") {
    const screen = (
      <FinishedScreen state={state} player={player} sessionCode={sessionCode} sessionStatus={sessionStatus} onPlayAgain={playAgain} />
    );
    if (use3D) {
      return (
        <>
          <div className="fixed inset-0 z-0" aria-hidden="true">
            <SceneBoundary
              onError={() => {
                settleBeforeLeaving3D();
                setSceneFailed(true);
              }}>
              <FinishedBackdrop outcome={state.outcome === "victory" ? "victory" : "doomed"} heroId={player.heroId} playerName={player.name} />
            </SceneBoundary>
          </div>
          <div className="relative z-10">
            <PageShell>
              <div className="mt-[18vh]">{screen}</div>
            </PageShell>
          </div>
        </>
      );
    }
    return <PlayFrame hearts={state.hearts}>{screen}</PlayFrame>;
  }

  const revealing = state.status === "reveal" && result !== null && result.floorIndex === state.index;

  // Shared question body (2D panel and 3D sheet).
  const questionBody = (f: Floor) => (
    <>
      <FloorHeader floor={f} floorNumber={state.index + 1} headingId={headingId} />
      {f.kind === "boss" ? (
        <BossInput
          floor={f}
          text={bossText}
          judging={judging}
          onChange={(text) => setBoss({ index: state.index, text, judging: false, runStartedAt: state.startedAt })}
          onSubmit={() => submitBoss(Date.now())}
        />
      ) : (
        <ChoiceList floor={f} onAnswer={(choiceId) => dispatch({ type: "ANSWER", choiceId, now: Date.now() })} />
      )}
    </>
  );

  // ---- 3D ---------------------------------------------------------------------------------------
  if (use3D) {
    const viewFloor = state.floors[view.index] ?? floor;
    if (!viewFloor) return <PlayLoader message="Building the tower" />;
    const questionOpen = view.phase === "engaged" && state.status === "floor" && view.index === state.index;
    const revealOpen = view.phase === "engaged" && revealing && view.index === state.index;
    const panel =
      questionOpen && floor ? (
        questionBody(floor)
      ) : revealOpen && result && floor ? (
        <RevealPanel
          floor={floor}
          result={result}
          heartsLeft={state.hearts}
          isLastFloor={state.index >= state.floors.length - 1}
          onNext={onRevealNext3D}
        />
      ) : null;

    return (
      <SceneBoundary
              onError={() => {
                settleBeforeLeaving3D();
                setSceneFailed(true);
              }} fallback={<PlayLoader message="Switching to 2D" />}>
        <ClimbScene
          heroId={player.heroId}
          playerName={player.name}
          floor={viewFloor}
          floorIndex={view.index}
          hearts={state.hearts}
          maxHearts={STARTING_HEARTS}
          phase={view.phase}
          questionOpen={questionOpen}
          panel={panel}
          panelKey={`${state.startedAt ?? 0}:${view.index}:${questionOpen ? "q" : revealOpen ? "r" : "-"}`}
          onTalk={onTalk}
          onStairs={onStairs}
          hud={
            <Hud
              variant="overlay"
              floors={state.floors}
              index={view.index}
              cleared={clearedFor(view, engineSnap)}
              hearts={state.hearts}
              maxHearts={STARTING_HEARTS}
              score={state.score}
              streak={state.streak}
              playerName={player.name}
              heroId={player.heroId}
              timeLimitMs={timeLimitFor(viewFloor)}
              remainingMs={questionOpen && !judging ? remainingMs : null}
              view={viewToggle}
            />
          }
          entrance={
            <div className="pointer-events-auto flex w-full max-w-sm items-center gap-2">
              <Button variant="secondary" size="lg" onClick={onChangeHero} aria-label="Change hero" className="shrink-0 !px-4">
                <span aria-hidden="true">🔄</span>
              </Button>
              <Button size="lg" onClick={() => setView({ index: 0, phase: "entering" })} aria-label="Enter the tower" className="flex-1">
                Enter <span aria-hidden="true">▶</span>
              </Button>
              {viewToggle && (
                <Button variant="secondary" size="lg" onClick={viewToggle.onToggle} aria-label="Switch to 2D" className="shrink-0 !px-4">
                  2D
                </Button>
              )}
            </div>
          }
        />
      </SceneBoundary>
    );
  }

  // ---- 2D ---------------------------------------------------------------------------------------
  if (state.status === "intro") {
    if (autoStart) return <PlayLoader message="The climb begins" />;
    return (
      <PlayFrame hearts={state.hearts}>
        <IntroScreen
          playerName={player.name}
          heroId={player.heroId}
          totalFloors={state.floors.length}
          onStart={() => dispatch({ type: "START", now: Date.now() })}
          onChangeHero={onChangeHero}
        />
        {viewToggle && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={viewToggle.onToggle} aria-label="Switch to 3D">
              3D
            </Button>
          </div>
        )}
      </PlayFrame>
    );
  }

  if (!floor) return <PlayLoader message="Building the tower" />;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Hud
        floors={state.floors}
        index={state.index}
        cleared={state.status === "reveal" ? state.index + 1 : state.index}
        hearts={state.hearts}
        maxHearts={STARTING_HEARTS}
        score={state.score}
        streak={state.streak}
        playerName={player.name}
        heroId={player.heroId}
        timeLimitMs={limit}
        remainingMs={revealing || judging ? null : remainingMs}
        view={viewToggle}
      />
      <LavaLayer hearts={state.hearts} max={STARTING_HEARTS} />
      <main id="main" className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 pb-[30vh]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${state.index}-${revealing ? "reveal" : "floor"}`}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <Panel
              className={`flex flex-col gap-4 sm:gap-5 ${floor.kind === "boss" ? "border-gold/50" : ""}`}
              role="region"
              aria-labelledby={revealing ? undefined : headingId}
              aria-label={revealing ? "Result" : undefined}
            >
              {revealing && result ? (
                <RevealPanel
                  floor={floor}
                  result={result}
                  heartsLeft={state.hearts}
                  isLastFloor={state.index >= state.floors.length - 1}
                  onNext={() => dispatch({ type: "NEXT", now: Date.now() })}
                />
              ) : (
                questionBody(floor)
              )}
            </Panel>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
