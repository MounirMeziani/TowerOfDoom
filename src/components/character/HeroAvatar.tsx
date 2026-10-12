import { HEROES, getHero } from "@/lib/characters";

export type HeroAvatarSize = "sm" | "md" | "lg" | "xl";

export interface HeroAvatarProps {
  heroId: string;
  size?: HeroAvatarSize;
  className?: string;
  /** Idle bob animation (default true). Always off under prefers-reduced-motion. */
  bob?: boolean;
}

// sm 28px / md 44px / lg 72px / xl 120px
const SIZES: Record<HeroAvatarSize, { box: string; emoji: string; bevel: number }> = {
  sm: { box: "size-7 border-2", emoji: "text-[0.9375rem]", bevel: 2 },
  md: { box: "size-11 border-2", emoji: "text-2xl", bevel: 3 },
  lg: { box: "size-18 border-[3px]", emoji: "text-[2.5rem]", bevel: 4 },
  xl: { box: "size-30 border-4", emoji: "text-[4.25rem]", bevel: 6 },
};

// Deduped + hoisted by React 19 (same href), so every avatar shares one stylesheet.
const BOB_CSS = `
.tod-hero-bob { animation: tod-hero-bob 2.4s steps(4, end) infinite; }
@keyframes tod-hero-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8%); } }
@media (prefers-reduced-motion: reduce) { .tod-hero-bob { animation: none !important; } }
`;

/** Hero emoji inside a colored pixel frame. */
export function HeroAvatar({ heroId, size = "md", className = "", bob = true }: HeroAvatarProps) {
  const hero = getHero(heroId);
  const s = SIZES[size];
  const index = Math.max(0, HEROES.findIndex((h) => h.id === hero.id));
  return (
    <span
      role="img"
      aria-label={hero.name}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[3px] leading-none ${s.box} ${className}`.trim()}
      style={{
        borderColor: hero.color,
        backgroundColor: `color-mix(in oklab, ${hero.color} 20%, #150c22)`,
        boxShadow: [
          `inset ${s.bevel}px ${s.bevel}px 0 0 color-mix(in oklab, ${hero.color} 22%, transparent)`,
          `inset -${s.bevel}px -${s.bevel}px 0 0 color-mix(in oklab, #0b0614 55%, transparent)`,
          `0 0 ${s.bevel * 6}px -${s.bevel * 2}px ${hero.color}`,
        ].join(", "),
      }}
    >
      {bob && (
        <style href="tod-hero-avatar" precedence="default">
          {BOB_CSS}
        </style>
      )}
      <span
        aria-hidden="true"
        className={`inline-block ${s.emoji} ${bob ? "tod-hero-bob" : ""} drop-shadow-[0_2px_0_rgb(0_0_0/0.45)]`}
        style={bob ? { animationDelay: `${(index % 4) * -0.6}s` } : undefined}
      >
        {hero.emoji}
      </span>
    </span>
  );
}
