"use client";

import type * as THREE from "three";
import { G, glowMat, shadowMat, type V3 } from "./shared";

/** Tiny primitive helpers: unit geometries scaled per mesh, shared materials passed in. */

interface PrimProps {
  p?: V3;
  s?: V3 | number;
  r?: V3;
  m: THREE.Material;
  renderOrder?: number;
}

function sc(s: V3 | number | undefined): V3 {
  if (s === undefined) return [1, 1, 1];
  return typeof s === "number" ? [s, s, s] : s;
}

export function Bx({ p, s, r, m, renderOrder }: PrimProps) {
  return <mesh position={p} scale={sc(s)} rotation={r} geometry={G.box()} material={m} renderOrder={renderOrder} />;
}

export function Cy({ p, s, r, m, segs = 8 }: PrimProps & { segs?: number }) {
  return <mesh position={p} scale={sc(s)} rotation={r} geometry={G.cyl(segs)} material={m} />;
}

export function Tp({ p, s, r, m, top, bottom, segs = 8 }: PrimProps & { top: number; bottom: number; segs?: number }) {
  return <mesh position={p} scale={sc(s)} rotation={r} geometry={G.taper(top, bottom, segs)} material={m} />;
}

export function Cn({ p, s, r, m, segs = 6 }: PrimProps & { segs?: number }) {
  return <mesh position={p} scale={sc(s)} rotation={r} geometry={G.cone(segs)} material={m} />;
}

export function Bl({ p, s, r, m, detail = 1 }: PrimProps & { detail?: number }) {
  return <mesh position={p} scale={sc(s)} rotation={r} geometry={G.ball(detail)} material={m} />;
}

export function Pl({ p, s, r, m, renderOrder }: PrimProps) {
  return <mesh position={p} scale={sc(s)} rotation={r} geometry={G.plane()} material={m} renderOrder={renderOrder} />;
}

/** Soft additive glow billboard. */
export function Glow({ p, size, color, opacity = 0.8 }: { p: V3; size: number; color: string; opacity?: number }) {
  return <sprite position={p} scale={[size, size, 1]} material={glowMat(color, opacity)} />;
}

/** Cheap fake contact shadow (dark blob on the ground). */
export function BlobShadow({ x = 0, z = 0, size = 1.2, opacity = 0.45 }: { x?: number; z?: number; size?: number; opacity?: number }) {
  return (
    <mesh position={[x, 0.012, z]} scale={[size, 1, size]} geometry={G.disc(20)} material={shadowMat(opacity)} renderOrder={1} />
  );
}
