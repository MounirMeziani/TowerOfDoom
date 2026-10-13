import * as THREE from "three";

/**
 * Shared, lazily-created three.js resources for the world scenes.
 * Everything is cached at module level so many meshes reuse a handful of geometries,
 * materials and canvas textures (cheap on phones). Nothing is created at import time,
 * so importing this file on the server is harmless.
 */

export type V3 = [number, number, number];

export const PAL = {
  bg: "#0b0614",
  surface: "#150c22",
  surface2: "#1f1233",
  line: "#34224f",
  text: "#f4eeff",
  ember: "#ff6b2c",
  ember2: "#ff9a3d",
  gold: "#ffcf4a",
  good: "#3ddc97",
  bad: "#ff4d6d",
  giving: "#4cc9f0",
  receiving: "#c77dff",
  skin: "#f0c9a0",
} as const;

// ---------------------------------------------------------------- deterministic randomness

/** FNV-1a string hash -> unsigned 32-bit int. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 seeded PRNG in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- geometries (unit sized, scale per mesh)

const geoCache = new Map<string, THREE.BufferGeometry>();
function cachedGeo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

export const G = {
  box: () => cachedGeo("box", () => new THREE.BoxGeometry(1, 1, 1)),
  /** Unit cylinder (radius 0.5, height 1). */
  cyl: (segs = 8) => cachedGeo(`cyl${segs}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, segs)),
  /** Tapered cylinder: radii are relative (scale the mesh for size). */
  taper: (top: number, bottom: number, segs = 8) =>
    cachedGeo(`taper${top}_${bottom}_${segs}`, () => new THREE.CylinderGeometry(top, bottom, 1, segs)),
  /** Unit cone (radius 0.5, height 1, tip at +y). */
  cone: (segs = 6) => cachedGeo(`cone${segs}`, () => new THREE.ConeGeometry(0.5, 1, segs)),
  /** Low-poly ball (radius 0.5). */
  ball: (detail = 1) => cachedGeo(`ball${detail}`, () => new THREE.IcosahedronGeometry(0.5, detail)),
  plane: () => cachedGeo("plane", () => new THREE.PlaneGeometry(1, 1)),
  /** Flat disc lying on the ground (radius 0.5). */
  disc: (segs = 24) =>
    cachedGeo(`disc${segs}`, () => new THREE.CircleGeometry(0.5, segs).rotateX(-Math.PI / 2)),
  /** Flat ring lying on the ground (outer radius 0.5). */
  ring: (inner = 0.4, segs = 40) =>
    cachedGeo(`ring${inner}_${segs}`, () => new THREE.RingGeometry(inner, 0.5, segs).rotateX(-Math.PI / 2)),
  torus: (tube = 0.08, segs = 24) =>
    cachedGeo(`torus${tube}_${segs}`, () => new THREE.TorusGeometry(0.5, tube, 6, segs)),
};

// ---------------------------------------------------------------- materials

const matCache = new Map<string, THREE.Material>();
function cachedMat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m as T;
}

export interface StdOpts {
  /** emissive color */
  e?: string;
  /** emissive intensity */
  ei?: number;
  /** roughness */
  r?: number;
  /** metalness */
  m?: number;
  /** opacity (enables transparency when < 1) */
  t?: number;
  /** smooth shading instead of the default flat low-poly look */
  smooth?: boolean;
  /** side */
  side?: THREE.Side;
}

/** Shared flat-shaded standard material. Treat as read-only. */
export function std(color: string, o: StdOpts = {}): THREE.MeshStandardMaterial {
  const key = `std|${color}|${o.e ?? ""}|${o.ei ?? 1}|${o.r ?? 0.8}|${o.m ?? 0.05}|${o.t ?? 1}|${o.smooth ? 1 : 0}|${o.side ?? 0}`;
  return cachedMat(key, () => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: o.r ?? 0.8,
      metalness: o.m ?? 0.05,
      flatShading: !o.smooth,
      side: o.side ?? THREE.FrontSide,
    });
    if (o.e) {
      mat.emissive = new THREE.Color(o.e);
      mat.emissiveIntensity = o.ei ?? 1;
    }
    if (o.t !== undefined && o.t < 1) {
      mat.transparent = true;
      mat.opacity = o.t;
      mat.depthWrite = false;
    }
    return mat;
  });
}

export interface BasicOpts {
  /** opacity */
  t?: number;
  /** additive blending (glows) */
  add?: boolean;
  /** affected by scene fog (default true) */
  fog?: boolean;
  side?: THREE.Side;
  /** tone mapped (default false so emissive accents stay punchy) */
  tm?: boolean;
  map?: THREE.Texture | null;
}

/** Shared unlit material — used for glows, signs and other emissive accents. Treat as read-only. */
export function basic(color: string, o: BasicOpts = {}): THREE.MeshBasicMaterial {
  const key = `basic|${color}|${o.t ?? 1}|${o.add ? 1 : 0}|${o.fog ?? true}|${o.side ?? 0}|${o.tm ?? false}|${o.map?.uuid ?? ""}`;
  return cachedMat(key, () => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      fog: o.fog ?? true,
      side: o.side ?? THREE.FrontSide,
      toneMapped: o.tm ?? false,
      map: o.map ?? null,
    });
    if (o.add || (o.t !== undefined && o.t < 1) || o.map) {
      mat.transparent = true;
      mat.opacity = o.t ?? 1;
      mat.depthWrite = false;
    }
    if (o.add) mat.blending = THREE.AdditiveBlending;
    return mat;
  });
}

/** Additive glow sprite material tinted with `color`. */
export function glowMat(color: string, opacity = 0.8, fog = true): THREE.SpriteMaterial {
  return cachedMat(`glow|${color}|${opacity}|${fog}`, () => {
    const mat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog,
    });
    return mat;
  });
}

/** Sprite material showing a canvas texture (emoji / label). */
export function spriteMat(tex: THREE.Texture, opts: { fog?: boolean; color?: string } = {}): THREE.SpriteMaterial {
  return cachedMat(`sprite|${tex.uuid}|${opts.fog ?? true}|${opts.color ?? "#fff"}`, () => {
    return new THREE.SpriteMaterial({
      map: tex,
      color: opts.color ?? "#ffffff",
      transparent: true,
      alphaTest: 0.05,
      toneMapped: false,
      fog: opts.fog ?? true,
    });
  });
}

/** Fake contact shadow: dark soft disc. */
export function shadowMat(opacity = 0.45): THREE.MeshBasicMaterial {
  return cachedMat(`shadow|${opacity}`, () => {
    return new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      color: "#000000",
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    });
  });
}

// ---------------------------------------------------------------- canvas textures

const texCache = new Map<string, THREE.Texture>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  setup?: (t: THREE.CanvasTexture) => void,
): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit as THREE.CanvasTexture;
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  setup?.(tex);
  tex.needsUpdate = true;
  texCache.set(key, tex);
  return tex;
}

/** Soft white radial falloff (tint via material color). */
export function glowTexture(): THREE.CanvasTexture {
  return canvasTexture("glow", 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function shadowTexture(): THREE.CanvasTexture {
  return canvasTexture("shadow", 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif`;

/** An emoji drawn onto a transparent square canvas. */
export function emojiTexture(emoji: string, size = 128): THREE.CanvasTexture {
  return canvasTexture(`emoji|${emoji}|${size}`, size, size, (ctx, w, h) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.floor(size * 0.78)}px ${EMOJI_FONT}`;
    ctx.fillText(emoji, w / 2, h / 2 + size * 0.04);
  });
}

export interface LabelOpts {
  color?: string;
  bg?: string | null;
  border?: string | null;
  glow?: string | null;
  w?: number;
  h?: number;
  weight?: number;
  /** font size as a fraction of canvas height */
  size?: number;
  radius?: number;
  font?: string;
}

/** Short label (a number, "OLSEN", "12"...) drawn to a canvas texture. */
export function labelTexture(text: string, o: LabelOpts = {}): THREE.CanvasTexture {
  const w = o.w ?? 256;
  const h = o.h ?? 128;
  const key = `label|${text}|${JSON.stringify(o)}`;
  return canvasTexture(key, w, h, (ctx) => {
    if (o.bg) {
      const r = o.radius ?? h * 0.18;
      ctx.fillStyle = o.bg;
      roundRect(ctx, 4, 4, w - 8, h - 8, r);
      ctx.fill();
      if (o.border) {
        ctx.lineWidth = Math.max(3, h * 0.05);
        ctx.strokeStyle = o.border;
        ctx.stroke();
      }
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${o.weight ?? 900} ${Math.floor(h * (o.size ?? 0.62))}px ${o.font ?? `ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif`}`;
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = h * 0.16;
    }
    ctx.fillStyle = o.color ?? PAL.text;
    ctx.fillText(text, w / 2, h / 2 + h * 0.03);
    if (o.glow) {
      ctx.shadowBlur = h * 0.06;
      ctx.fillText(text, w / 2, h / 2 + h * 0.03);
    }
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dark marble checkerboard (2x2 tiles per texture repeat). */
export function marbleTexture(a: string, b: string, vein: string, repeat: [number, number]): THREE.CanvasTexture {
  return canvasTexture(
    `marble|${a}|${b}|${vein}|${repeat.join(",")}`,
    256,
    256,
    (ctx, w, h) => {
      const half = w / 2;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? a : b;
          ctx.fillRect(i * half, j * half, half, half);
        }
      const r = rng(7);
      ctx.strokeStyle = vein;
      ctx.lineCap = "round";
      for (let k = 0; k < 14; k++) {
        ctx.globalAlpha = 0.08 + r() * 0.14;
        ctx.lineWidth = 0.6 + r() * 1.6;
        ctx.beginPath();
        let x = r() * w;
        let y = r() * h;
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += (r() - 0.3) * 40;
          y += (r() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, half, half);
      ctx.strokeRect(half, half, half, half);
      ctx.strokeRect(half, 0, half, half);
      ctx.strokeRect(0, half, half, half);
      ctx.globalAlpha = 1;
    },
    (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    },
  );
}

/** Molten lava texture (tileable-ish blobs). A fresh clone is returned so callers can scroll it. */
export function lavaTexture(): THREE.CanvasTexture {
  const base = canvasTexture("lava", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#7a1405";
    ctx.fillRect(0, 0, w, h);
    const r = rng(42);
    const blob = (x: number, y: number, rad: number, c0: string, c1: string) => {
      for (const dx of [-w, 0, w])
        for (const dy of [-h, 0, h]) {
          const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          g.addColorStop(0, c0);
          g.addColorStop(1, c1);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
    };
    for (let i = 0; i < 26; i++) blob(r() * w, r() * h, 18 + r() * 40, "rgba(255,120,30,0.9)", "rgba(255,60,10,0)");
    for (let i = 0; i < 18; i++) blob(r() * w, r() * h, 6 + r() * 16, "rgba(255,220,90,0.95)", "rgba(255,150,40,0)");
    for (let i = 0; i < 10; i++) blob(r() * w, r() * h, 8 + r() * 20, "rgba(40,6,4,0.7)", "rgba(40,6,4,0)");
  });
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Vertical sky gradient for a back-side sphere (v=0 bottom, v=1 top). */
export function gradientTexture(stops: Array<[number, string]>): THREE.CanvasTexture {
  return canvasTexture(`grad|${JSON.stringify(stops)}`, 4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Stormy cloud bank painted on a wide canvas (for the lobby window). */
export function stormTexture(): THREE.CanvasTexture {
  return canvasTexture("storm", 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#07040f");
    g.addColorStop(0.55, "#22103a");
    g.addColorStop(0.85, "#4a1b3d");
    g.addColorStop(1, "#7a2a2a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(1234);
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = r() * h * 0.75;
      const rad = 20 + r() * 60;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const light = r() < 0.25;
      cg.addColorStop(0, light ? "rgba(120,80,170,0.45)" : "rgba(10,5,20,0.65)");
      cg.addColorStop(1, "rgba(10,5,20,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // distant city skyline silhouette
    ctx.fillStyle = "#0a0612";
    let x = 0;
    while (x < w) {
      const bw = 12 + r() * 30;
      const bh = 20 + r() * 50;
      ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = "rgba(255,190,90,0.5)";
      for (let k = 0; k < 4; k++) if (r() < 0.5) ctx.fillRect(x + 3 + r() * (bw - 6), h - bh + 4 + r() * (bh - 8), 2, 2);
      ctx.fillStyle = "#0a0612";
      x += bw + 2;
    }
  });
}
