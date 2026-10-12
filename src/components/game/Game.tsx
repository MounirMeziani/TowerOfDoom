"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useReducer, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { BOSS_FLOORS_CONTENT, REGULAR_FLOORS } from "@/content/floors";
import { judgeAnswer } from "@/lib/api";
import { STARTING_HEARTS } from "@/lib/game/constants";
import { currentFloor, floorsCleared, gameReducer, initGame, lastResult, timeLimitFor } from "@/lib/game/engine";
import { fallbackJudge } from "@/lib/game/judge-fallback";
import { buildRun } from "@/lib/game/run";
import { buildRunSubmission, runKeyFor, submitOnce } from "@/lib/game/submit";
import { useLobbyPresence } from "@/lib/lobby";
import type { JudgeResult, LobbyPresence, Mode, Player, SessionStatus } from "@/lib/types";
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

const TICK_MS = 250;
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
    feedback: typeof r.feedback === "string" && r.feedback.trim() ? r.feedback : "The boss has judged your words.",
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
  const [state, dispatch] = useReducer(gameReducer, undefined, () => initGame(newRun()));
  const [now, setNow] = useState(0);
  const [boss, setBoss] = useState<BossDraft>(EMPTY_DRAFT);
  const [joinedAt] = useState(() => new Date().toISOString());

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
  // Only redirect from the intro screen. A finished run must stay put so FinishedScreen shows the result
  // (and offers the round-2 lobby) instead of the run vanishing when the host resets to the lobby.
  const backToLobby = !!sessionCode && sessionStatus === "lobby" && state.status === "intro";

  useEffect(() => {
    if (autoStart && state.status === "intro") dispatch({ type: "START", now: Date.now() });
  }, [autoStart, state.status]);

  useEffect(() => {
    if (backToLobby && sessionCode) router.replace(`/lobby/${sessionCode}`);
  }, [backToLobby, sessionCode, router]);

  const me = useMemo<LobbyPresence | null>(() => {
    if (!sessionCode) return null;
    // Auto-starting: skip the one-render 'lobby' update so only the 'playing' presence message goes out.
    if (state.status === "intro" && autoStart) return null;
    const finished = state.status === "finished";
    return {
      playerId: player.id,
      name: player.name,
      heroId: player.heroId,
      phase: finished ? "finished" : state.status === "intro" ? "lobby" : "playing",
      floor: finished ? cleared : Math.min(state.index + 1, state.floors.length),
      score: state.score,
      hearts: state.hearts,
      joinedAt,
    };
  }, [sessionCode, autoStart, player.id, player.name, player.heroId, state.status, state.index, state.floors.length, state.score, state.hearts, cleared, joinedAt]);
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

  // ---- Keyboard: 1-4 answer, Enter = next ------------------------------------------------------
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || target?.isContentEditable) return;
    if (state.status === "floor" && floor && floor.kind !== "boss") {
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= floor.choices.length) {
        e.preventDefault();
        dispatch({ type: "ANSWER", choiceId: floor.choices[n - 1].id, now: Date.now() });
      }
    } else if (state.status === "reveal" && e.key === "Enter") {
      if (tag === "BUTTON" || tag === "A") return; // native activation handles it
      e.preventDefault();
      dispatch({ type: "NEXT", now: Date.now() });
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Scroll to the top on every screen change so phones always start at the villain / banner.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [state.status, state.index]);

  // ---- Render ---------------------------------------------------------------------------------
  if (backToLobby) return <PlayLoader message="Heading to the lobby..." />;

  if (state.status === "intro") {
    if (autoStart) return <PlayLoader message="The climb begins..." />;
    return (
      <PlayFrame hearts={state.hearts}>
        <IntroScreen
          playerName={player.name}
          heroId={player.heroId}
          totalFloors={state.floors.length}
          onStart={() => dispatch({ type: "START", now: Date.now() })}
          onChangeHero={onChangeHero}
        />
      </PlayFrame>
    );
  }

  if (state.status === "finished") {
    return (
      <PlayFrame hearts={state.hearts}>
        <FinishedScreen
          state={state}
          player={player}
          sessionCode={sessionCode}
          sessionStatus={sessionStatus}
          onPlayAgain={() => {
            setBoss(EMPTY_DRAFT);
            dispatch({ type: "RESTART", floors: newRun(), now: Date.now() });
          }}
        />
      </PlayFrame>
    );
  }

  if (!floor) return <PlayLoader message="Building the tower..." />;

  const revealing = state.status === "reveal" && result !== null && result.floorIndex === state.index;

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
            <Panel className={`flex flex-col gap-4 sm:gap-5 ${floor.kind === "boss" ? "border-gold/50" : ""}`}>
              <FloorHeader floor={floor} floorNumber={state.index + 1} compact={revealing} />
              {revealing && result ? (
                <RevealPanel
                  floor={floor}
                  result={result}
                  heartsLeft={state.hearts}
                  isLastFloor={state.index >= state.floors.length - 1}
                  onNext={() => dispatch({ type: "NEXT", now: Date.now() })}
                />
              ) : floor.kind === "boss" ? (
                <BossInput
                  floor={floor}
                  text={bossText}
                  judging={judging}
                  onChange={(text) => setBoss({ index: state.index, text, judging: false, runStartedAt: state.startedAt })}
                  onSubmit={() => submitBoss(Date.now())}
                />
              ) : (
                <ChoiceList floor={floor} onAnswer={(choiceId) => dispatch({ type: "ANSWER", choiceId, now: Date.now() })} />
              )}
            </Panel>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
