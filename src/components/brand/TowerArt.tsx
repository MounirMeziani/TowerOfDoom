// Original inline-SVG pixel-art office tower: 12 floors of windows, a glowing doom eye in the storm,
// and a lava glow at the base. Pure SVG + CSS (no images); every animation stops under reduced motion.

export interface TowerArtProps {
  /** Floors lit from the bottom (0-12). Omit for an ambient, randomly lit tower. */
  floorsLit?: number;
  className?: string;
}

const FLOORS = 12;
const FLOOR_H = 18;
const TOWER_X = 30;
const TOWER_W = 100;
const TOP_Y = 64; // top edge of floor 12
const BASE_Y = TOP_Y + FLOORS * FLOOR_H; // 280: bottom edge of floor 1
const WINDOW_XS = [41, 63, 85, 107] as const;
const BOSS_FLOORS = new Set([6, 12]);

// Deterministic "random" ambient pattern so server and client renders always match.
function ambient(floor: number, col: number): "lit" | "flicker" | "dark" {
  const n = (floor * 7 + col * 5 + floor * col * 3) % 11;
  if (n === 0 || n === 4) return "flicker";
  if (n < 6) return "lit";
  return "dark";
}

const PARTICLES = [
  { x: 22, d: 0, s: 4.2 },
  { x: 44, d: 1.4, s: 5.1 },
  { x: 61, d: 2.6, s: 3.8 },
  { x: 79, d: 0.7, s: 4.7 },
  { x: 97, d: 3.1, s: 5.4 },
  { x: 116, d: 1.9, s: 4.1 },
  { x: 134, d: 0.3, s: 5.8 },
  { x: 150, d: 2.2, s: 4.4 },
] as const;

const CSS = `
.tod-tw-flicker { animation: tod-tw-flicker 3.2s steps(1, end) infinite; }
.tod-tw-eye { animation: tod-tw-pulse 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.tod-tw-pupil { animation: tod-tw-look 7s steps(1, end) infinite; }
.tod-tw-bolt { animation: tod-tw-bolt 6s linear infinite; }
.tod-tw-lava { animation: tod-tw-lava 2.4s ease-in-out infinite alternate; }
.tod-tw-ember { animation: tod-tw-rise linear infinite; }
.tod-tw-current { animation: tod-tw-current 1.1s steps(2, end) infinite; }
@keyframes tod-tw-flicker { 0%, 100% { opacity: 1; } 18% { opacity: 0.15; } 22% { opacity: 1; } 61% { opacity: 0.25; } 64% { opacity: 1; } }
@keyframes tod-tw-pulse { 0%, 100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes tod-tw-look { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(-4px); } 55% { transform: translateX(4px); } 75% { transform: translateX(0); } }
@keyframes tod-tw-bolt { 0%, 88%, 100% { opacity: 0; } 89% { opacity: 1; } 91% { opacity: 0.2; } 92% { opacity: 1; } 95% { opacity: 0; } }
@keyframes tod-tw-lava { from { opacity: 0.65; } to { opacity: 1; } }
@keyframes tod-tw-rise { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-110px); opacity: 0; } }
@keyframes tod-tw-current { 0% { opacity: 1; } 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .tod-tw-flicker, .tod-tw-eye, .tod-tw-pupil, .tod-tw-bolt, .tod-tw-lava, .tod-tw-ember, .tod-tw-current { animation: none !important; }
  .tod-tw-ember { opacity: 0.5; }
}
`;

export function TowerArt({ floorsLit, className = "" }: TowerArtProps) {
  const lit = floorsLit === undefined ? undefined : Math.max(0, Math.min(FLOORS, Math.floor(floorsLit)));
  const label =
    lit === undefined
      ? "Pixel-art Olsen Tower of Doom: a 12-floor office tower under a storm, watched by a glowing eye, rising from a pool of lava"
      : `Pixel-art Olsen Tower of Doom with ${lit} of 12 floors lit`;

  return (
    <svg
      viewBox="0 0 160 300"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={`block h-auto w-full select-none ${className}`.trim()}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{CSS}</style>
      <defs>
        <filter id="tod-tw-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="tod-tw-lava-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf4a" />
          <stop offset="0.35" stopColor="#ff9a3d" />
          <stop offset="1" stopColor="#ff6b2c" />
        </linearGradient>
        <radialGradient id="tod-tw-base-glow" cx="0.5" cy="1" r="0.75">
          <stop offset="0" stopColor="#ff6b2c" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ff6b2c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tod-tw-eye-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6b2c" stopOpacity="0.9" />
          <stop offset="1" stopColor="#c77dff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Storm clouds */}
      <g fill="#1f1233">
        <rect x="4" y="18" width="36" height="8" />
        <rect x="12" y="12" width="20" height="6" />
        <rect x="118" y="22" width="38" height="8" />
        <rect x="126" y="16" width="22" height="6" />
        <rect x="0" y="40" width="22" height="6" />
        <rect x="140" y="44" width="20" height="6" />
      </g>
      <g fill="#34224f">
        <rect x="8" y="26" width="28" height="3" />
        <rect x="122" y="30" width="30" height="3" />
      </g>
      {/* Lightning */}
      <path
        className="tod-tw-bolt"
        d="M134 30 h6 l-5 10 h5 l-9 16 l2 -11 h-5 z"
        fill="#ffcf4a"
        style={{ opacity: 0 }}
      />

      {/* Eye glow halo */}
      <circle className="tod-tw-eye" cx="80" cy="34" r="30" fill="url(#tod-tw-eye-glow)" />

      {/* Spire */}
      <g fill="#150c22" stroke="#34224f" strokeWidth="2">
        <rect x="76" y="2" width="8" height="10" />
        <rect x="70" y="10" width="20" height="10" />
        <rect x="58" y="20" width="44" height="28" />
      </g>
      <rect x="56" y="46" width="48" height="6" fill="#34224f" />

      {/* Doom eye */}
      <ellipse cx="80" cy="34" rx="16" ry="8" fill="#ffcf4a" />
      <ellipse cx="80" cy="34" rx="16" ry="8" fill="#ff6b2c" opacity="0.35" filter="url(#tod-tw-glow)" />
      <g className="tod-tw-pupil">
        <rect x="77" y="27" width="6" height="14" fill="#0b0614" />
        <rect x="78" y="29" width="2" height="3" fill="#ff6b2c" />
      </g>

      {/* Battlements */}
      <g fill="#1f1233" stroke="#34224f" strokeWidth="2">
        {[30, 50, 70, 90, 110].map((x) => (
          <rect key={x} x={x} y="52" width="12" height="12" />
        ))}
        <rect x={TOWER_X + TOWER_W - 12} y="52" width="12" height="12" />
      </g>

      {/* Tower body with pixel bevel */}
      <rect x={TOWER_X} y={TOP_Y} width={TOWER_W} height={BASE_Y - TOP_Y} fill="#1f1233" />
      <rect x={TOWER_X} y={TOP_Y} width="4" height={BASE_Y - TOP_Y} fill="#34224f" />
      <rect x={TOWER_X + TOWER_W - 4} y={TOP_Y} width="4" height={BASE_Y - TOP_Y} fill="#150c22" />

      {/* Floors (floor 1 at the bottom) */}
      {Array.from({ length: FLOORS }, (_, i) => {
        const floor = i + 1;
        const y = BASE_Y - floor * FLOOR_H;
        const isBoss = BOSS_FLOORS.has(floor);
        const isCurrent = lit !== undefined && floor === lit + 1;
        return (
          <g key={floor}>
            <rect x={TOWER_X} y={y} width={TOWER_W} height="2" fill="#0b0614" opacity="0.7" />
            {WINDOW_XS.map((wx, col) => {
              const state = lit === undefined ? ambient(floor, col) : floor <= lit ? "lit" : isCurrent ? "current" : "dark";
              const on = state !== "dark";
              const fill = !on ? "#150c22" : isBoss ? "#ff4d6d" : col % 3 === 1 ? "#ff9a3d" : "#ffcf4a";
              return (
                <g key={wx} className={state === "flicker" ? "tod-tw-flicker" : state === "current" ? "tod-tw-current" : undefined}>
                  <rect x={wx} y={y + 5} width="12" height="9" fill={fill} />
                  {on ? (
                    <rect x={wx} y={y + 5} width="12" height="3" fill="#fff4cc" opacity="0.35" />
                  ) : (
                    <rect x={wx + 2} y={y + 7} width="3" height="2" fill="#34224f" />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Door + foundation */}
      <rect x="22" y={BASE_Y} width="116" height="8" fill="#34224f" />
      <rect x="70" y={BASE_Y - 14} width="20" height="14" fill="#0b0614" />
      <rect x="72" y={BASE_Y - 12} width="16" height="12" fill="#ff6b2c" opacity="0.55" />

      {/* Lava + glow */}
      <rect x="0" y="230" width="160" height="70" fill="url(#tod-tw-base-glow)" className="tod-tw-lava" />
      <rect x="0" y={BASE_Y + 8} width="160" height={300 - BASE_Y - 8} fill="url(#tod-tw-lava-grad)" />
      <g fill="#ffcf4a">
        <rect x="10" y={BASE_Y + 9} width="8" height="2" />
        <rect x="46" y={BASE_Y + 11} width="12" height="2" />
        <rect x="104" y={BASE_Y + 9} width="10" height="2" />
        <rect x="140" y={BASE_Y + 12} width="8" height="2" />
      </g>

      {/* Rising embers */}
      <g>
        {PARTICLES.map((p) => (
          <rect
            key={p.x}
            className="tod-tw-ember"
            x={p.x}
            y={BASE_Y + 4}
            width="2"
            height="2"
            fill={p.x % 3 === 0 ? "#ffcf4a" : "#ff9a3d"}
            style={{ animationDelay: `${p.d}s`, animationDuration: `${p.s}s`, opacity: 0 }}
          />
        ))}
      </g>
    </svg>
  );
}
