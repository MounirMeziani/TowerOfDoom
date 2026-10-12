// 7x6 pixel heart drawn with SVG rects. Purely decorative (callers provide text alternatives).
const PIXELS = [
  "0110110",
  "1111111",
  "1111111",
  "0111110",
  "0011100",
  "0001000",
];

export function PixelHeart({ filled, className = "" }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 7 6"
      aria-hidden="true"
      className={`h-4 w-[1.2rem] sm:h-5 sm:w-6 ${className}`.trim()}
      shapeRendering="crispEdges"
    >
      {PIXELS.flatMap((row, y) =>
        row.split("").map((cell, x) =>
          cell === "1" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={filled ? (x === 1 && y === 1 ? "#ffd1db" : "var(--bad)") : "var(--line)"}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function HeartsRow({ hearts, max }: { hearts: number; max: number }) {
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${hearts} of ${max} hearts left`}>
      {Array.from({ length: max }, (_, i) => (
        <PixelHeart key={i} filled={i < hearts} className={i < hearts ? "" : "opacity-70"} />
      ))}
    </span>
  );
}
