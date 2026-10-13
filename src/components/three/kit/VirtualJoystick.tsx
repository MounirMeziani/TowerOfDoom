"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useCoarsePointer } from "@/lib/three/support";
import type { MovementController } from "./useMovementController";

const BASE = 120;
const KNOB = 52;
const TRAVEL = (BASE - KNOB) / 2 + 6;
const DEAD_ZONE = 0.12;

/**
 * Touch joystick (bottom-left). Renders only on coarse pointers and tracks a
 * single pointerId, so a second finger can still tap the scene.
 */
export function VirtualJoystick({ ctrl }: { ctrl: MovementController }) {
  const coarse = useCoarsePointer();
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  // Never leave the hero walking if the joystick unmounts mid-drag.
  useEffect(() => {
    return () => ctrl.setInput(0, 0);
  }, [ctrl, coarse]);

  if (!coarse) return null;

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > TRAVEL) {
      dx = (dx / len) * TRAVEL;
      dy = (dy / len) * TRAVEL;
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / TRAVEL;
    const ny = dy / TRAVEL;
    const mag = Math.hypot(nx, ny);
    if (mag < DEAD_ZONE) ctrl.setInput(0, 0);
    else ctrl.setInput(nx, ny);
  };

  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    ctrl.setInput(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    baseRef.current?.removeAttribute("data-active");
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Joystick"
      className="tod-joystick"
      style={{
        position: "absolute",
        left: "max(16px, env(safe-area-inset-left))",
        bottom: "calc(max(16px, env(safe-area-inset-bottom)) + 8px)",
        width: BASE,
        height: BASE,
        borderRadius: "50%",
        background: "radial-gradient(circle at 50% 45%, rgba(52,34,79,0.55), rgba(21,12,34,0.75))",
        border: "2px solid rgba(255,107,44,0.45)",
        boxShadow: "0 0 24px rgba(255,107,44,0.18), inset 0 0 18px rgba(0,0,0,0.5)",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "auto",
        zIndex: 20,
      }}
      onPointerDown={(e) => {
        if (pointerId.current !== null) return;
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.setAttribute("data-active", "");
        e.preventDefault();
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerId.current !== e.pointerId) return;
        e.preventDefault();
        update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={knobRef}
        aria-hidden
        style={{
          position: "absolute",
          left: (BASE - KNOB) / 2 - 2,
          top: (BASE - KNOB) / 2 - 2,
          width: KNOB,
          height: KNOB,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #ff9a3d, #ff6b2c 60%, #b8431a)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5), 0 0 16px rgba(255,107,44,0.5)",
          transform: "translate(0px, 0px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
