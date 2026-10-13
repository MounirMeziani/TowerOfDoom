"use client";

import { TowerArt } from "@/components/brand/TowerArt";
import { HeroAvatar } from "@/components/character/HeroAvatar";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { REGULAR_TIME_LIMIT_MS, STARTING_HEARTS } from "@/lib/game/constants";
import { HeartsRow } from "./PixelHeart";

interface IntroScreenProps {
  playerName: string;
  heroId: string;
  totalFloors: number;
  onStart: () => void;
  onChangeHero: () => void;
}

/** Tower entrance (2D): hero, three icon facts, Enter. */
export function IntroScreen({ playerName, heroId, totalFloors, onStart, onChangeHero }: IntroScreenProps) {
  return (
    <Panel className="flex flex-col items-center gap-6 text-center">
      <h1 className="sr-only">Tower entrance</h1>
      <div className="w-20 sm:w-26">
        <TowerArt />
      </div>
      <div className="flex items-center gap-3">
        <HeroAvatar heroId={heroId} size="md" />
        <span className="font-pixel text-xs text-text sm:text-sm">{playerName}</span>
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-4 font-pixel text-[0.625rem] text-muted sm:text-xs">
        <li aria-label={`${totalFloors} floors`} className="flex items-center gap-1.5">
          <span aria-hidden="true">🏢</span>
          <span aria-hidden="true">{totalFloors}</span>
        </li>
        <li className="flex items-center">
          <HeartsRow hearts={STARTING_HEARTS} max={STARTING_HEARTS} />
        </li>
        <li aria-label={`${REGULAR_TIME_LIMIT_MS / 1000} seconds per floor`} className="flex items-center gap-1.5">
          <span aria-hidden="true">⏱</span>
          <span aria-hidden="true">{REGULAR_TIME_LIMIT_MS / 1000}s</span>
        </li>
      </ul>
      <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" onClick={onStart} className="w-full sm:flex-1">
          Enter <span aria-hidden="true">▶</span>
        </Button>
        <Button variant="ghost" onClick={onChangeHero} className="w-full sm:w-auto" aria-label="Change hero">
          <span aria-hidden="true">🔄</span> Hero
        </Button>
      </div>
    </Panel>
  );
}
