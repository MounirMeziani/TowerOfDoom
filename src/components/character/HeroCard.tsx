import type { ReactNode } from "react";
import { getHero } from "@/lib/characters";
import { HeroAvatar, type HeroAvatarSize } from "./HeroAvatar";

export interface HeroCardProps {
  name: string;
  heroId: string;
  highlight?: boolean;
  subtitle?: string;
  className?: string;
  /** Avatar size (default md). */
  avatarSize?: HeroAvatarSize;
  /** Optional trailing content (score, status chip...). */
  children?: ReactNode;
}

/** Player name + hero avatar card (lobby grids, previews, HUD). */
export function HeroCard({
  name,
  heroId,
  highlight = false,
  subtitle,
  className = "",
  avatarSize = "md",
  children,
}: HeroCardProps) {
  const hero = getHero(heroId);
  return (
    <div
      className={`relative flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border-2 bg-surface p-3 ${highlight ? "" : "border-line"} ${className}`.trim()}
      style={
        highlight
          ? {
              borderColor: hero.color,
              backgroundImage: `linear-gradient(100deg, color-mix(in oklab, ${hero.color} 16%, transparent), transparent 65%)`,
              boxShadow: `0 0 24px -8px ${hero.color}, inset 0 0 0 1px rgb(255 255 255 / 0.04)`,
            }
          : undefined
      }
    >
      <HeroAvatar heroId={hero.id} size={avatarSize} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">{name || "Nameless Hero"}</p>
        <p className="truncate text-xs font-medium" style={{ color: hero.color }}>
          {subtitle ?? hero.name}
        </p>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}
