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

function Banner({ good, title, subtitle }: { good: boolean; title: string; subtitle: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: good ? -3 : 3 }}
      animate={reduce ? undefined : { scale: 1, opacity: 1, rotate: 0, x: good ? 0 : [0, -8, 8, -5, 5, 0] }}
      transition={{ type: "spring", stiffness: 320, damping: 16, x: { duration: 0.4 } }}
      className={`rounded-lg border-2 px-4 py-3 text-center ${
        good ? "border-good bg-good/15 text-good" : "border-bad bg-bad/15 text-bad"
      }`}
    >
      <p className="font-pixel text-sm sm:text-base">{title}</p>
      <p className="mt-1 text-sm font-semibold text-text">{subtitle}</p>
    </motion.div>
  );
}

function PointsRow({ items }: { items: { label: string; value: number }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg border-2 border-line bg-bg/60 p-3 text-sm">
      {items.map((i) => (
        <div key={i.label} className="contents">
          <dt className="text-muted">{i.label}</dt>
          <dd className="text-right font-pixel text-[0.625rem] text-text tabular-nums">+{i.value}</dd>
        </div>
      ))}
      <div className="contents">
        <dt className="border-t border-line pt-1 font-semibold text-text">Floor total</dt>
        <dd className="border-t border-line pt-1 text-right font-pixel text-xs text-gold tabular-nums">+{total}</dd>
      </div>
    </dl>
  );
}

function badgeState(a: AKey, hits: AKey[], misses: AKey[]): "hit" | "miss" | "neutral" {
  if (misses.includes(a)) return "miss";
  if (hits.includes(a)) return "hit";
  return "neutral";
}

/** Like ABadge, but with its own visible + screen-reader wording (spot floors judge A's, they don't "hit" them). */
function VerdictBadge({ a, good, note }: { a: AKey; good: boolean; note: string }) {
  const giving = A_INFO[a].mode === "giving";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold whitespace-nowrap ${
        good ? "border-good bg-good/15 text-good" : "border-bad bg-bad/15 text-bad"
      }`}
    >
      <span aria-hidden="true" className={`inline-block size-2 rounded-[1px] ${giving ? "bg-giving" : "bg-receiving"}`} />
      <span aria-hidden="true">{good ? "✓" : "✗"}</span>
      <span>
        {A_INFO[a].label} <span className="font-normal">{note}</span>
      </span>
    </span>
  );
}

function RegularReveal({ floor, result }: { floor: RegularFloor; result: RegularFloorResult }) {
  const picked = floor.choices.find((c) => c.id === result.choiceId) ?? null;
  const correct = floor.choices.find((c) => c.correct) ?? null;
  const modeAs = MODE_AS[floor.mode];
  const isSpot = floor.kind === "spot";
  const quotePresent = isSpot ? spotQuotePresence(floor) : null;

  return (
    <>
      {result.correct ? (
        <Banner good title="CORRECT!" subtitle={result.streak >= 2 ? `${result.streak} in a row. Keep climbing!` : "The villain staggers back."} />
      ) : result.timedOut ? (
        <Banner good={false} title="TIME'S UP!" subtitle="The villain struck while you hesitated. -1 heart" />
      ) : (
        <Banner good={false} title="OUCH!" subtitle="That one hit you. -1 heart" />
      )}

      {result.correct && (
        <PointsRow
          items={[
            { label: "Correct answer", value: result.breakdown.base },
            { label: "Streak bonus", value: result.breakdown.streak },
            { label: "Speed bonus", value: result.breakdown.speed },
          ]}
        />
      )}

      {isSpot && quotePresent && (
        <section className="flex flex-col gap-2" aria-label="What the quote really does">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">The quote:</h3>
          <div className="flex flex-wrap gap-2">
            {modeAs.map((a) => {
              const present = quotePresent.includes(a);
              return <VerdictBadge key={a} a={a} good={present} note={present ? "present" : "missing"} />;
            })}
          </div>
        </section>
      )}

      {picked && (
        <section className="flex flex-col gap-2" aria-label="Your answer">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">You chose</h3>
          <p className={`rounded-lg border-2 p-3 text-base ${picked.correct ? "border-good/60" : "border-bad/60"}`}>
            {picked.text}
          </p>
          {isSpot ? (
            !picked.correct && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-muted">Your call on each A</p>
                <div className="flex flex-wrap gap-2">
                  {modeAs.map((a) => {
                    const wrong = picked.misses.includes(a);
                    return <VerdictBadge key={a} a={a} good={!wrong} note={wrong ? "judged wrong" : "judged right"} />;
                  })}
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {modeAs.map((a) => (
                <ABadge key={a} a={a} state={badgeState(a, picked.hits, picked.misses)} />
              ))}
            </div>
          )}
          <p className="text-base leading-relaxed text-text/90">{picked.explanation}</p>
        </section>
      )}

      {!result.correct && correct && (
        <section className="flex flex-col gap-2" aria-label="The best answer">
          <h3 className="text-xs font-semibold tracking-wide text-good uppercase">The best answer</h3>
          <p className="rounded-lg border-2 border-good/60 bg-good/5 p-3 text-base">{correct.text}</p>
          {!isSpot && (
            <div className="flex flex-wrap gap-2">
              {modeAs.map((a) => (
                <ABadge key={a} a={a} state={badgeState(a, correct.hits, correct.misses)} />
              ))}
            </div>
          )}
          <p className="text-base leading-relaxed text-text/90">{correct.explanation}</p>
        </section>
      )}
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
        <span aria-hidden="true" className="ml-1 font-pixel text-[0.625rem] text-muted">
          {score}/2
        </span>
      </span>
    </div>
  );
}

function BossReveal({ floor, result }: { floor: BossFloor; result: BossFloorResult }) {
  const judge = result.judge;
  const modeAs = MODE_AS[floor.mode];
  return (
    <>
      {result.correct ? (
        <Banner good title="BOSS DEFEATED!" subtitle={`${floor.villain.name} crumbles before your words.`} />
      ) : result.timedOut ? (
        <Banner good={false} title="TIME'S UP!" subtitle="You stayed silent and the boss struck. -1 heart" />
      ) : (
        <Banner good={false} title="THE BOSS RESISTS!" subtitle="Not quite enough to win. -1 heart" />
      )}

      {judge && (
        <section className="flex flex-col gap-2" aria-label="Judge scores">
          <div className="grid gap-2 sm:grid-cols-2">
            {modeAs.map((a) => (
              <ScorePips key={a} a={a} score={Math.max(0, Math.min(2, judge.scores[a] ?? 0))} />
            ))}
          </div>
          <p className="text-base leading-relaxed text-text/90">
            <span className="font-semibold text-ember-2">{judge.source === "ai" ? "The Judge says: " : "Quick judge: "}</span>
            {judge.feedback}
          </p>
        </section>
      )}

      <PointsRow
        items={[
          { label: "A-points (75 each)", value: result.breakdown.aPoints },
          { label: "Boss defeated bonus", value: result.breakdown.pass },
        ]}
      />

      {result.answer && (
        <section className="flex flex-col gap-2" aria-label="Your answer">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">You wrote</h3>
          <p className="rounded-lg border-2 border-line p-3 text-base whitespace-pre-wrap">{result.answer}</p>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-label="Model answer">
        <h3 className="text-xs font-semibold tracking-wide text-good uppercase">A model answer</h3>
        <p className="rounded-lg border-2 border-good/60 bg-good/5 p-3 text-base leading-relaxed">{floor.exemplar}</p>
      </section>
    </>
  );
}

export function RevealPanel({ floor, result, heartsLeft, isLastFloor, onNext }: RevealPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const doomed = heartsLeft <= 0;
  const nextLabel = doomed ? "Face your doom" : isLastFloor ? "Claim victory" : "Next floor";

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div ref={ref} tabIndex={-1} className="flex flex-col gap-4 outline-none" aria-live="polite" aria-atomic="false">
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
