"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { ABadge } from "@/components/ui/ABadge";
import { Button } from "@/components/ui/Button";
import type { BossFloorResult, FloorResult, RegularFloorResult } from "@/lib/game/engine";
import { spotQuotePresence } from "@/lib/game/spot";
import { A_INFO, MODE_AS, type AKey, type BossFloor, type Floor, type RegularFloor } from "@/lib/types";

interface RevealPanelProps {
  floor: Floor;
  result: FloorResult;
  heartsLeft: number;
  isLastFloor: boolean;
  onNext: () => void;
}

/** ✓ / ✗ / ⏱ plus the points (or a lost heart). Words only for screen readers. */
function Verdict({ result }: { result: FloorResult }) {
  const reduce = useReducedMotion();
  const good = result.correct;
  const icon = good ? "✓" : result.timedOut ? "⏱" : "✗";
  const label = good ? "Correct" : result.timedOut ? "Time's up" : "Wrong";
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={reduce ? undefined : { scale: 1, opacity: 1, x: good ? 0 : [0, -8, 8, -5, 5, 0] }}
      transition={{ type: "spring", stiffness: 320, damping: 16, x: { duration: 0.4 } }}
      className={`flex items-center justify-between gap-3 rounded-lg border-2 px-4 py-2 ${
        good ? "border-good bg-good/15" : "border-bad bg-bad/15"
      }`}
    >
      <span role="img" aria-label={label} className={`font-pixel text-2xl ${good ? "text-good" : "text-bad"}`}>
        {icon}
      </span>
      <span className="flex items-center gap-3 font-pixel text-sm tabular-nums">
        {result.points > 0 && (
          <span className="text-gold">
            <span className="sr-only">Points: </span>+{result.points}
          </span>
        )}
        {result.heartLost && (
          <span role="img" aria-label="Lost a heart" className="text-bad">
            -❤
          </span>
        )}
      </span>
    </motion.div>
  );
}

function badgeState(a: AKey, hits: AKey[], misses: AKey[]): "hit" | "miss" | "neutral" {
  if (misses.includes(a)) return "miss";
  if (hits.includes(a)) return "hit";
  return "neutral";
}

function RegularReveal({ floor, result }: { floor: RegularFloor; result: RegularFloorResult }) {
  const picked = floor.choices.find((c) => c.id === result.choiceId) ?? null;
  const best = floor.choices.find((c) => c.correct) ?? null;
  const modeAs = MODE_AS[floor.mode];
  const quotePresent = floor.kind === "spot" ? spotQuotePresence(floor) : null;
  // One plain "why": your pick's explanation (or the best answer's on a timeout).
  const why = (picked ?? best)?.explanation;
  const badgeSource = picked ?? best;

  return (
    <>
      {!result.correct && best && (
        <p className="flex gap-2 rounded-lg border-2 border-good/60 bg-good/5 p-3 text-base">
          <span role="img" aria-label="Best answer" className="text-good">
            ✓
          </span>
          <span className="min-w-0">{best.text}</span>
        </p>
      )}
      {why && <p className="text-base leading-relaxed text-text/90">{why}</p>}
      <div className="flex flex-wrap gap-2">
        {quotePresent
          ? modeAs.map((a) => <ABadge key={a} a={a} state={quotePresent.includes(a) ? "hit" : "miss"} />)
          : badgeSource
            ? modeAs.map((a) => <ABadge key={a} a={a} state={badgeState(a, badgeSource.hits, badgeSource.misses)} />)
            : null}
      </div>
    </>
  );
}

function ScorePips({ a, score }: { a: AKey; score: number }) {
  const giving = A_INFO[a].mode === "giving";
  const fill = giving ? "bg-giving" : "bg-receiving";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-line bg-bg/60 px-3 py-2">
      <span className={`text-sm font-semibold ${giving ? "text-giving" : "text-receiving"}`}>{A_INFO[a].label}</span>
      <span className="flex items-center gap-1.5" role="img" aria-label={`${score} out of 2`}>
        {[0, 1].map((i) => (
          <span key={i} className={`block size-4 rounded-[2px] border-2 ${i < score ? `${fill} border-transparent` : "border-line"}`} />
        ))}
      </span>
    </div>
  );
}

function BossReveal({ floor, result }: { floor: BossFloor; result: BossFloorResult }) {
  const judge = result.judge;
  return judge ? (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODE_AS[floor.mode].map((a) => (
          <ScorePips key={a} a={a} score={Math.max(0, Math.min(2, judge.scores[a] ?? 0))} />
        ))}
      </div>
      <p className="text-base leading-relaxed text-text/90">{judge.feedback}</p>
    </>
  ) : null;
}

export function RevealPanel({ floor, result, heartsLeft, isLastFloor, onNext }: RevealPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const doomed = heartsLeft <= 0;
  const nextLabel = isLastFloor || doomed ? "Finish" : "Next";

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={ref} tabIndex={-1} className="flex flex-col gap-4 outline-none" aria-live="polite" aria-atomic="false">
      <Verdict result={result} />
      {floor.kind === "boss" && result.kind === "boss" ? (
        <BossReveal floor={floor} result={result} />
      ) : floor.kind !== "boss" && result.kind === "regular" ? (
        <RegularReveal floor={floor} result={result} />
      ) : null}

      <Button size="lg" onClick={onNext} className="w-full" variant={doomed ? "danger" : "primary"}>
        {nextLabel} <span aria-hidden="true">↵</span>
      </Button>
    </div>
  );
}
