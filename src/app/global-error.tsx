"use client";

import { useEffect, type CSSProperties } from "react";

// global-error replaces the root layout, so it gets no fonts, providers or globals.css:
// every token below is inlined with the same values as the :root theme.
const BG = "#0b0614";
const SURFACE_2 = "#1f1233";
const LINE = "#34224f";
const TEXT = "#f4eeff";
const EMBER = "#ff6b2c";
const EMBER_2 = "#ff9a3d";

const btn: CSSProperties = {
  minWidth: 56,
  minHeight: 48,
  padding: "10px 20px",
  borderRadius: 6,
  border: `2px solid ${EMBER_2}`,
  background: EMBER,
  color: BG,
  font: "700 18px ui-monospace, monospace",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnAlt: CSSProperties = { ...btn, border: `2px solid ${LINE}`, background: SURFACE_2, color: TEXT };

function setMode2d(): void {
  try {
    window.localStorage.setItem("tod.mode2d", "1");
  } catch {
    /* storage blocked: the event still flips the in-tab preference listeners */
  }
  window.dispatchEvent(new Event("tod:mode2d"));
}

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" style={{ background: BG, colorScheme: "dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: BG,
          color: TEXT,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "40px 16px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <title>Olsen Tower of Doom</title>
        <svg width="72" height="120" viewBox="0 0 60 100" aria-hidden="true">
          <rect x="12" y="10" width="36" height="86" rx="2" fill={SURFACE_2} stroke={LINE} strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5].map((r) =>
            [0, 1, 2].map((c) => (
              <rect key={`${r}-${c}`} x={18 + c * 9} y={18 + r * 12} width="6" height="6" fill={r % 2 === c % 2 ? EMBER : LINE} />
            )),
          )}
          <circle cx="30" cy="6" r="4" fill={EMBER_2} />
        </svg>
        <h1 style={{ margin: 0, fontSize: 32, color: EMBER_2 }}>
          <span aria-hidden="true">⚠</span>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Something went wrong
          </span>
        </h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <button type="button" style={btn} aria-label="Retry" title="Retry" onClick={() => retry()}>
            <span aria-hidden="true">↻</span>
          </button>
          <button
            type="button"
            style={btnAlt}
            aria-label="2D"
            title="2D"
            onClick={() => {
              setMode2d();
              reset();
            }}
          >
            2D
          </button>
          {/* Plain anchor: a full reload is the safest way out when the root layout crashed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={btnAlt} aria-label="Home" title="Home">
            <span aria-hidden="true">🏠</span>
          </a>
        </div>
      </body>
    </html>
  );
}
