"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, PerformanceMonitor } from "@react-three/drei";

const BG = "#0b0614";

/*
 * Overlay hit-testing: the overlay layer lets taps fall through to the scene
 * except on interactive elements (buttons, links, form fields, dialogs) and
 * anything marked `pointer-events-auto` or `data-interactive`.
 */
const OVERLAY_CSS = `
.tod-overlay{pointer-events:none}
.tod-overlay :is(button,a,input,textarea,select,label,summary,[role=button],[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=slider],[role=application],[data-interactive],dialog,form){pointer-events:auto}
.tod-canvas canvas{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;outline:none}
@keyframes tod-pulse{0%,100%{opacity:.45;transform:scale(.94)}50%{opacity:1;transform:scale(1)}}
`;

/** Small pulsing tower glyph used while the 3D scene loads (no text). */
export function TowerLoader({ size = 44 }: { size?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ animation: "tod-pulse 1.2s ease-in-out infinite" }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <path d="M8 22V7l4-4 4 4v15z" fill="#150c22" stroke="#ff6b2c" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10.5 10h3M10.5 13.5h3M10.5 17h3" stroke="#ffcf4a" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 22h14" stroke="#ff6b2c" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Full-size R3F canvas with the tower's night palette, fog, adaptive DPR and
 * an optional DOM overlay. Load the module that renders this with
 * next/dynamic({ ssr: false }).
 */
export function GameCanvas({
  children,
  overlay,
  camera,
  className,
  label,
  onFallback,
}: {
  children: ReactNode;
  overlay?: ReactNode;
  camera?: { position: [number, number, number]; fov?: number };
  className?: string;
  /**
   * Accessible name for the scene (e.g. "Floor 3"). With a label the canvas is
   * exposed as one role="img"; without one it is aria-hidden. Either way the
   * in-canvas DOM (drei <Html> name tags, bubbles) stays out of the reading order.
   */
  label?: string;
  /** Called when PerformanceMonitor gives up (persistently low fps). Callers can switch to 2D for this session. */
  onFallback?: () => void;
}) {
  const [maxDpr, setMaxDpr] = useState(1.5);
  const [ready, setReady] = useState(false);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: BG,
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
      <style href="tod-game-canvas" precedence="default">
        {OVERLAY_CSS}
      </style>
      <div
        className="tod-canvas"
        style={{ position: "absolute", inset: 0, zIndex: 0 }}
        {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      >
        <Canvas
          dpr={maxDpr > 1 ? [1, maxDpr] : 1}
          camera={{ position: camera?.position ?? [0, 6, 9], fov: camera?.fov ?? 50, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false, stencil: false, powerPreference: "high-performance" }}
          fallback={
            <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
              <TowerLoader />
            </div>
          }
          onCreated={({ gl }) => {
            // R3F defaults to ACES Filmic tone mapping + sRGB output; just lift exposure a touch.
            gl.toneMappingExposure = 1.1;
            // Test hook: live renderer stats (draw calls, triangles) for Playwright perf checks.
            (window as Window & { __TOD_GL__?: unknown }).__TOD_GL__ = gl.info;
            setReady(true);
          }}
          style={{ touchAction: "none" }}
        >
          <color attach="background" args={[BG]} />
          <fog attach="fog" args={[BG, 16, 52]} />
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setMaxDpr(1)}
            onIncline={() => setMaxDpr(1.5)}
            onFallback={() => {
              setMaxDpr(1);
              onFallback?.();
            }}
          />
          <Suspense
            fallback={
              <Html center>
                <TowerLoader />
              </Html>
            }
          >
            {children}
          </Suspense>
        </Canvas>
      </div>
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 5, pointerEvents: "none" }}>
          <TowerLoader />
        </div>
      )}
      {overlay ? (
        <div className="tod-overlay" style={{ position: "absolute", inset: 0, zIndex: 10 }}>
          {overlay}
        </div>
      ) : null}
    </div>
  );
}
