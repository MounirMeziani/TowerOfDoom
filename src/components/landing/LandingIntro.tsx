import { TowerArt } from "@/components/brand/TowerArt";
import { Wordmark } from "@/components/brand/Wordmark";

/** Wordmark + tower art. No copy. */
export function LandingIntro() {
  return (
    <div className="flex items-center justify-center gap-5 lg:flex-col lg:items-start lg:gap-8">
      <Wordmark as="h1" size="lg" align="start" />
      <div className="relative w-20 shrink-0 sm:w-28 lg:w-44">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-1/2 bottom-0 h-2/3 bg-[radial-gradient(closest-side,rgb(255_107_44/0.35),transparent)]"
        />
        <TowerArt className="relative drop-shadow-[0_0_24px_rgb(199_125_255/0.25)]" />
      </div>
    </div>
  );
}
