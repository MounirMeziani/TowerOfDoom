import { ImageResponse } from "next/og";

export const alt = "Olsen Tower of Doom: climb 12 floors and master the 2 A's of Feedback";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FLOORS = 12;
const WINDOWS = 4;

function windowColor(floor: number, col: number): string {
  if (floor === 6 || floor === 12) return "#ff4d6d";
  const n = (floor * 7 + col * 5 + floor * col * 3) % 11;
  if (n < 6) return col % 3 === 1 ? "#ff9a3d" : "#ffcf4a";
  return "#150c22";
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(180deg, #0b0614 0%, #1a0b22 65%, #4a1a0c 100%)",
          color: "#f4eeff",
          padding: "64px 80px",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 18, color: "#a597c2" }}>OLSEN</div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, color: "#ff6b2c", lineHeight: 1.05, marginTop: 8 }}>
            TOWER OF DOOM
          </div>
          <div style={{ display: "flex", fontSize: 36, marginTop: 32, lineHeight: 1.3 }}>
            Climb 12 floors. Defeat the feedback villains. Master the 2 A&apos;s.
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 40 }}>
            {[
              { label: "Assist", color: "#4cc9f0" },
              { label: "Actionable", color: "#4cc9f0" },
              { label: "Appreciate", color: "#c77dff" },
              { label: "Accept or Decline", color: "#c77dff" },
            ].map((a) => (
              <div
                key={a.label}
                style={{
                  display: "flex",
                  fontSize: 24,
                  padding: "8px 16px",
                  border: `3px solid ${a.color}`,
                  color: a.color,
                  borderRadius: 6,
                }}
              >
                {a.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: 96,
              height: 48,
              background: "#1f1233",
              border: "4px solid #34224f",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ display: "flex", width: 60, height: 26, borderRadius: 30, background: "#ffcf4a", justifyContent: "center" }}>
              <div style={{ display: "flex", width: 12, height: 26, background: "#0b0614" }} />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 220,
              padding: "12px 16px",
              background: "#1f1233",
              borderLeft: "8px solid #34224f",
              gap: 8,
            }}
          >
            {Array.from({ length: FLOORS }, (_, i) => {
              const floor = FLOORS - i;
              return (
                <div key={floor} style={{ display: "flex", justifyContent: "space-between" }}>
                  {Array.from({ length: WINDOWS }, (_, col) => (
                    <div key={col} style={{ display: "flex", width: 34, height: 22, background: windowColor(floor, col) }} />
                  ))}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", width: 300, height: 28, background: "#ff6b2c" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
