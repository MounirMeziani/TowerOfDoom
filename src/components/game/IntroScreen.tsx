"use client";

import { TowerArt } from "@/components/brand/TowerArt";
import { HeroCard } from "@/components/character/HeroCard";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { getHero } from "@/lib/characters";
import { REGULAR_TIME_LIMIT_MS, STARTING_HEARTS } from "@/lib/game/constants";
import { PixelHeart } from "./PixelHeart";

interface IntroScreenProps {
  playerName: string;
  heroId: string;
  totalFloors: number;
  onStart: () => void;
  onChangeHero: () => void;
}

export function IntroScreen({ playerName, heroId, totalFloors, onStart, onChangeHero }: IntroScreenProps) {
  const hero = getHero(heroId);
  return (
    <Panel className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-20 shrink-0 sm:w-26">
          <TowerArt />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-pixel text-[0.625rem] text-muted">THE TOWER ENTRANCE</p>
          <h1 className="font-pixel text-sm leading-relaxed text-ember sm:text-lg">Climb {totalFloors} floors of feedback villains</h1>
        </div>
      </div>

      <HeroCard name={playerName} heroId={heroId} subtitle={`${hero.name} · ${hero.perk}`} highlight />

      <section aria-labelledby="rules-heading" className="flex flex-col gap-3">
        <h2 id="rules-heading" className="font-pixel text-[0.625rem] text-gold sm:text-xs">
          HOW TO SURVIVE
        </h2>
        <ul className="flex flex-col gap-3 text-base leading-relaxed">
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-xl">
              🗡️
            </span>
            <span>
              Each floor tests the 2 A&apos;s. <strong className="text-giving">Giving</strong> feedback: Assist + Actionable.{" "}
              <strong className="text-receiving">Receiving</strong>: Appreciate + Accept or Decline. Pick the best move in{" "}
              {REGULAR_TIME_LIMIT_MS / 1000}s. Number keys 1-4 work too.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex items-center">
              <PixelHeart filled />
            </span>
            <span>
              You have {STARTING_HEARTS} hearts. A wrong answer, a timeout or a lost boss fight costs one. Lose them all and you&apos;re
              DOOMED.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-xl">
              👹
            </span>
            <span>
              Bosses on floors 6 and 12 make you write your own answer, and a judge scores each A. Streaks and speed earn bonus
              points.
            </span>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" onClick={onStart} className="w-full sm:flex-1">
          Enter the Tower
        </Button>
        <Button variant="ghost" onClick={onChangeHero} className="w-full sm:w-auto">
          Change hero
        </Button>
      </div>
    </Panel>
  );
}
