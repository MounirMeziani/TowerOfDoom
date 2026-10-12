import Link from "next/link";
import { TowerArt } from "@/components/brand/TowerArt";
import { Wordmark } from "@/components/brand/Wordmark";
import { BOSS_FLOORS, STARTING_HEARTS, TOTAL_FLOORS } from "@/lib/game/constants";

const STATS = [
  { value: String(TOTAL_FLOORS), label: "Floors", tone: "text-gold" },
  { value: String(Object.keys(BOSS_FLOORS).length), label: "Bosses", tone: "text-ember" },
  { value: "♥".repeat(STARTING_HEARTS), label: "Hearts", tone: "text-bad" },
] as const;

/** Wordmark, pitch, tower art and run stats. */
export function LandingIntro({ joining }: { joining: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted">
          <span aria-hidden="true" className="inline-block size-1.5 bg-ember" />
          A feedback dungeon crawler by Olsen Consulting
        </p>
        <Wordmark as="h1" size="lg" align="start" />
      </div>

      <div className="flex items-center gap-4 overflow-x-clip sm:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <p className="text-lg leading-snug font-bold text-balance text-text sm:text-2xl">
            Climb 12 floors. Defeat the feedback villains. Master the 2 A&apos;s.
          </p>
          <p className="text-sm leading-relaxed text-muted sm:text-base">
            Every floor is a real moment at work. Give feedback that{" "}
            <span className="font-semibold text-giving">Assists</span> and is{" "}
            <span className="font-semibold text-giving">Actionable</span>. Receive it by saying thanks (
            <span className="font-semibold text-receiving">Appreciate</span>) and choosing what to act on (
            <span className="font-semibold text-receiving">Accept or Decline</span>).
          </p>
          {!joining && (
            <div className="hidden flex-wrap gap-x-4 gap-y-1 sm:flex">
              <Link
                href="/learn"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-gold underline-offset-4 hover:underline"
              >
                Learn the 2 A&apos;s first <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </div>
          )}
        </div>
        <div className="relative w-28 shrink-0 sm:w-40 lg:w-48">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-1/2 bottom-0 h-2/3 bg-[radial-gradient(closest-side,rgb(255_107_44/0.35),transparent)]"
          />
          <TowerArt className="relative drop-shadow-[0_0_24px_rgb(199_125_255/0.25)]" />
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:max-w-md sm:gap-3" aria-label="Each run">
        {STATS.map((s) => (
          <li
            key={s.label}
            className="flex flex-col items-center gap-1.5 rounded-md border-2 border-line bg-surface/80 px-2 py-2.5 text-center"
          >
            <span className={`font-pixel text-sm leading-none ${s.tone}`}>
              {s.label === "Hearts" ? (
                <>
                  <span aria-hidden="true">{s.value}</span>
                  <span className="sr-only">{STARTING_HEARTS}</span>
                </>
              ) : (
                s.value
              )}
            </span>
            <span className="font-pixel text-[0.625rem] leading-none text-muted uppercase">{s.label}</span>
          </li>
        ))}
      </ul>

      {!joining && (
        <a
          href="#join"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-dashed border-ember/60 px-4 text-sm font-semibold text-ember-2 sm:hidden"
        >
          Create your hero <span aria-hidden="true">↓</span>
        </a>
      )}
    </div>
  );
}
