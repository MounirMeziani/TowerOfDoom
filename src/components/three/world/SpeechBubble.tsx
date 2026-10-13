"use client";

import { Html } from "@react-three/drei";

export interface SpeechBubbleProps {
  text: string;
  position: [number, number, number];
}

/** Small DOM speech bubble anchored to a point in 3D. Keep `text` to 1-2 words. */
export function SpeechBubble({ text, position }: SpeechBubbleProps) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div
        className="tod-bubble"
        style={{
          position: "relative",
          transform: "translateY(-50%)",
          whiteSpace: "nowrap",
          background: "#f4eeff",
          color: "#150c22",
          border: "3px solid #ffcf4a",
          borderRadius: 14,
          padding: "6px 14px",
          fontWeight: 900,
          fontSize: 18,
          lineHeight: 1.1,
          boxShadow: "0 6px 0 rgba(0,0,0,0.35), 0 0 22px rgba(255,207,74,0.45)",
          userSelect: "none",
          animation: "tod-bubble-pop 220ms cubic-bezier(.2,1.6,.4,1) both",
        }}
      >
        {text}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            bottom: -11,
            width: 16,
            height: 16,
            background: "#f4eeff",
            borderRight: "3px solid #ffcf4a",
            borderBottom: "3px solid #ffcf4a",
            transform: "translateX(-50%) rotate(45deg)",
          }}
        />
        <style>{`@keyframes tod-bubble-pop{from{transform:translateY(-50%) scale(.6);opacity:0}to{transform:translateY(-50%) scale(1);opacity:1}}@media (prefers-reduced-motion: reduce){.tod-bubble{animation:none!important}}`}</style>
      </div>
    </Html>
  );
}
