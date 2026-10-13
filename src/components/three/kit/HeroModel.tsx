"use client";

import { forwardRef, useImperativeHandle, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  MathUtils,
  Vector3,
  type BufferGeometry,
  type PerspectiveCamera,
  type Group,
  type Mesh,
} from "three";
import { getHero } from "@/lib/characters";
import { getHeroLook, hash01, type HeroLook } from "@/lib/three/heroLooks";
import { dampAngle, dampFactor, type MovementState } from "@/lib/three/movement";

export interface HeroModelProps {
  heroId: string;
  name?: string;
  position?: [number, number, number];
  rotationY?: number;
  moving?: boolean;
  isSelf?: boolean;
  scale?: number;
  showName?: boolean;
  /** Extra: drive position/facing/walk from a live MovementState every frame (no re-renders). */
  motionRef?: MutableRefObject<MovementState>;
  /** Extra: multiplier for the emoji/name tag size (e.g. 2 for a far projector camera). */
  labelSize?: number;
  /** Mount the emoji/name tag at all (default true). False removes the DOM overlay entirely. */
  showLabel?: boolean;
  /** Convenience inverse of showLabel (e.g. hide the self tag during the sensei two-shot). */
  hideLabel?: boolean;
  /**
   * "full" (default): the whole chibi with headwear, props and limb animation.
   * "lite": blob + one body capsule + head (3 meshes, no limb animation) for far / crowded heroes.
   */
  detail?: "full" | "lite";
}

/* ---------- shared, lazily created GPU resources (one set for all heroes) ---------- */

type Geo = Record<
  | "torso"
  | "arm"
  | "leg"
  | "boot"
  | "head"
  | "hand"
  | "eye"
  | "blob"
  | "ring"
  | "hairCap"
  | "helmet"
  | "hoodCap"
  | "belt"
  | "robe"
  | "liteBody",
  BufferGeometry
>;
let geoCache: Geo | null = null;
function geo(): Geo {
  if (!geoCache) {
    geoCache = {
      torso: new CapsuleGeometry(0.26, 0.3, 3, 8),
      arm: new CapsuleGeometry(0.085, 0.24, 2, 6),
      leg: new CapsuleGeometry(0.1, 0.22, 2, 6),
      boot: new BoxGeometry(0.19, 0.12, 0.27),
      head: new SphereGeometry(0.31, 12, 9),
      hand: new SphereGeometry(0.075, 6, 4),
      eye: new SphereGeometry(0.042, 6, 4),
      blob: new CircleGeometry(0.48, 18),
      ring: new RingGeometry(0.52, 0.64, 36),
      hairCap: new SphereGeometry(0.325, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52),
      helmet: new SphereGeometry(0.345, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hoodCap: new SphereGeometry(0.37, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.64),
      belt: new CylinderGeometry(0.275, 0.275, 0.07, 10),
      robe: new CylinderGeometry(0.26, 0.42, 0.56, 9, 1, true),
      // Lite LOD: one capsule from the boots to the shoulders.
      liteBody: new CapsuleGeometry(0.28, 0.62, 3, 8),
    };
  }
  return geoCache;
}

/*
 * Headwear / prop geometries, shared by every hero instance (keyed by args), so
 * a crowd allocates each shape once instead of once per hero. Never disposed:
 * the set is small and bounded by the hero catalogue.
 */
const shapeCache = new Map<string, BufferGeometry>();
function shared(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = shapeCache.get(key);
  if (!g) {
    g = make();
    shapeCache.set(key, g);
  }
  return g;
}
const box = (w: number, h: number, d: number) => shared(`box:${w},${h},${d}`, () => new BoxGeometry(w, h, d));
const cone = (r: number, h: number, seg: number) => shared(`cone:${r},${h},${seg}`, () => new ConeGeometry(r, h, seg));
const cyl = (rt: number, rb: number, h: number, seg: number) =>
  shared(`cyl:${rt},${rb},${h},${seg}`, () => new CylinderGeometry(rt, rb, h, seg));
const sphere = (r: number, w: number, h: number) => shared(`sphere:${r},${w},${h}`, () => new SphereGeometry(r, w, h));
const torus = (r: number, tube: number, rs: number, ts: number, arc = Math.PI * 2) =>
  shared(`torus:${r},${tube},${rs},${ts},${arc}`, () => new TorusGeometry(r, tube, rs, ts, arc));
const octa = (r: number, d: number) => shared(`octa:${r},${d}`, () => new OctahedronGeometry(r, d));
const icosa = (r: number, d: number) => shared(`icosa:${r},${d}`, () => new IcosahedronGeometry(r, d));

const matCache = new Map<string, MeshStandardMaterial>();
/** Shared flat-shaded material per colour (+ optional emissive glow / metal). */
function mat(color: string, opts: { glow?: number; metal?: boolean } = {}): MeshStandardMaterial {
  const key = `${color}|${opts.glow ?? 0}|${opts.metal ? 1 : 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: opts.metal ? 0.35 : 0.75,
      metalness: opts.metal ? 0.65 : 0.05,
      emissive: opts.glow ? new Color(color) : new Color(0x000000),
      emissiveIntensity: opts.glow ?? 0,
    });
    matCache.set(key, m);
  }
  return m;
}

const shade = (hex: string, k: number) => `#${new Color(hex).multiplyScalar(k).getHexString()}`;

let blobMat: MeshBasicMaterial | null = null;
let ringMat: MeshBasicMaterial | null = null;
function blobMaterial() {
  blobMat ??= new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  return blobMat;
}
function ringMaterial() {
  // One shared material: every self ring pulses together (only one per screen).
  ringMat ??= new MeshBasicMaterial({ color: "#ff6b2c", transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return ringMat;
}

/* ---------- per-class headwear & props ---------- */

function Headwear({ look, color }: { look: HeroLook; color: string }) {
  const g = geo();
  const hair = mat(look.hair);
  const metal = mat("#a9b4c6", { metal: true });
  switch (look.headwear) {
    case "helmet":
      return (
        <group>
          <mesh geometry={g.helmet} material={metal} rotation-x={-0.12} />
          <mesh position={[0, 0.02, 0.32]} material={metal} geometry={box(0.06, 0.2, 0.05)} />
          <mesh position={[0, 0.35, -0.02]} material={mat(look.accent, { glow: 0.3 })} geometry={box(0.06, 0.1, 0.36)} />
        </group>
      );
    case "plumed-helm":
      return (
        <group>
          <mesh geometry={g.helmet} material={metal} rotation-x={-0.12} />
          <mesh position={[0, 0.42, -0.08]} rotation-x={-0.5} material={mat(look.cape ?? color, { glow: 0.25 })} geometry={cone(0.08, 0.38, 5)} />
          <mesh position={[0, 0.03, 0.33]} material={mat(look.accent, { glow: 0.2 })} geometry={box(0.3, 0.04, 0.03)} />
        </group>
      );
    case "wizard-hat": {
      const hat = mat(shade(color, 0.55));
      return (
        <group>
          <mesh geometry={g.hairCap} material={hair} rotation-x={-0.25} scale={[1.02, 1, 1.05]} />
          <mesh position={[0, 0.24, 0]} material={hat} geometry={cyl(0.46, 0.46, 0.035, 12)} />
          <mesh position={[0, 0.29, 0]} material={mat(look.accent, { glow: 0.35 })} geometry={cyl(0.285, 0.3, 0.07, 10)} />
          <mesh position={[0.04, 0.6, -0.03]} rotation-z={-0.18} rotation-x={-0.12} material={hat} geometry={cone(0.29, 0.66, 8)} />
        </group>
      );
    }
    case "hood":
      return (
        <group>
          <mesh geometry={g.hairCap} material={hair} />
          <mesh geometry={g.hoodCap} material={mat(look.cape ?? look.dark)} position={[0, 0.01, -0.03]} rotation-x={-0.35} />
        </group>
      );
    case "leaf-crown":
      return (
        <group>
          <mesh geometry={g.hairCap} material={hair} rotation-x={-0.1} />
          {Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return (
              <mesh
                key={i}
                position={[Math.sin(a) * 0.27, 0.24, Math.cos(a) * 0.27]}
                rotation={[Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45]}
                material={mat(look.accent, { glow: 0.35 })}
                geometry={cone(0.06, 0.2, 4)}
              />
            );
          })}
        </group>
      );
    case "bald":
      return (
        <mesh position={[0, 0.17, 0.27]} material={mat(look.accent, { glow: 0.8 })} geometry={sphere(0.035, 6, 4)} />
      );
    case "beret":
      return (
        <group>
          <mesh geometry={g.hairCap} material={hair} rotation-x={-0.2} />
          <mesh position={[0.05, 0.27, -0.02]} rotation-z={-0.22} scale={[1.1, 0.32, 1.1]} material={mat(look.cape ?? color)} geometry={sphere(0.32, 10, 6)} />
          <mesh position={[-0.2, 0.42, -0.08]} rotation={[-0.4, 0, 0.7]} material={mat(look.accent, { glow: 0.4 })} geometry={cone(0.035, 0.42, 4)} />
        </group>
      );
    case "ninja-mask": {
      const cloth = mat(look.dark);
      const band = mat(look.accent, { glow: 0.3 });
      return (
        <group>
          <mesh geometry={g.hairCap} material={cloth} scale={1.03} />
          <mesh position={[0, 0.1, 0]} material={band} geometry={cyl(0.322, 0.322, 0.08, 12)} />
          <mesh position={[0, -0.12, 0.01]} material={cloth} geometry={cyl(0.318, 0.29, 0.2, 12)} />
          <mesh position={[0.06, 0.06, -0.38]} rotation={[0.6, 0.2, 0]} material={band} geometry={box(0.05, 0.03, 0.22)} />
          <mesh position={[-0.05, 0.04, -0.37]} rotation={[0.9, -0.2, 0]} material={band} geometry={box(0.05, 0.03, 0.2)} />
        </group>
      );
    }
  }
}

/** Held in the right hand (−X side); rendered inside the right arm pivot. */
function HandProp({ look }: { look: HeroLook }) {
  const wood = mat("#6b4423");
  switch (look.prop) {
    case "staff":
    case "druid-staff":
      return (
        <group position={[0, -0.4, 0.06]}>
          <mesh position={[0, 0.25, 0]} material={wood} geometry={cyl(0.03, 0.035, 1.05, 5)} />
          <mesh
            position={[0, 0.82, 0]}
            material={mat(look.accent, { glow: 1.1 })}
            geometry={look.prop === "staff" ? octa(0.1, 0) : icosa(0.1, 0)}
          />
        </group>
      );
    case "sword":
      return (
        <group position={[0, -0.4, 0.05]} rotation-x={1.2}>
          <mesh position={[0, 0.36, 0]} material={mat("#dfe6f2", { metal: true })} geometry={box(0.07, 0.6, 0.02)} />
          <mesh position={[0, 0.06, 0]} material={mat(look.accent, { glow: 0.3 })} geometry={box(0.24, 0.04, 0.05)} />
          <mesh position={[0, -0.02, 0]} material={mat(look.dark)} geometry={cyl(0.025, 0.025, 0.12, 5)} />
        </group>
      );
    default:
      return null;
  }
}

/** Worn on the left arm (+X side). */
function OffhandProp({ look, color }: { look: HeroLook; color: string }) {
  if (look.prop !== "shield") return null;
  return (
    <group position={[0.11, -0.22, 0.04]} rotation-z={Math.PI / 2}>
      <mesh material={mat(shade(color, 0.7), { metal: true })} geometry={cyl(0.24, 0.24, 0.05, 8)} />
      <mesh position={[0, -0.035, 0]} material={mat(look.accent, { glow: 0.45 })} geometry={cyl(0.09, 0.09, 0.03, 6)} />
    </group>
  );
}

/** Things on the back or around the torso (static relative to the body). */
function BodyProp({ look }: { look: HeroLook }) {
  switch (look.prop) {
    case "bow":
      return (
        <group position={[0, 0.88, -0.3]} rotation-z={0.5}>
          <mesh rotation-z={-Math.PI / 2} material={mat("#7a5230")} geometry={torus(0.38, 0.025, 4, 12, Math.PI)} />
          <mesh position={[0.14, 0, 0.06]} rotation-z={-0.5} material={mat(look.dark)} geometry={cyl(0.07, 0.06, 0.45, 6)} />
        </group>
      );
    case "beads":
      return (
        <mesh position={[0, 1.16, 0.02]} rotation-x={Math.PI / 2 - 0.25} material={mat(look.accent, { glow: 0.5 })} geometry={torus(0.2, 0.035, 4, 12)} />
      );
    case "lute":
      return (
        <group position={[0.02, 0.85, -0.32]} rotation-z={-0.7}>
          <mesh scale={[1, 1.15, 0.45]} material={mat("#b0702a")} geometry={sphere(0.2, 9, 6)} />
          <mesh position={[0, 0.36, 0]} material={mat("#5a3416")} geometry={box(0.06, 0.42, 0.04)} />
          <mesh position={[0, 0.0, 0.09]} material={mat(look.accent, { glow: 0.4 })} geometry={cyl(0.05, 0.05, 0.02, 8)} />
        </group>
      );
    case "katana":
      return (
        <group position={[0, 0.9, -0.3]} rotation-z={0.75}>
          <mesh position={[0, 0.12, 0]} material={mat("#1a1822", { metal: true })} geometry={box(0.06, 0.8, 0.04)} />
          <mesh position={[0, -0.36, 0]} material={mat(look.accent, { glow: 0.35 })} geometry={cyl(0.03, 0.03, 0.2, 5)} />
        </group>
      );
    default:
      return null;
  }
}

/* ---------- the hero ---------- */

/** Largest on-screen tag scale (x labelSize): drei's distanceFactor grows without bound as the camera closes in. */
const MAX_LABEL_SCALE = 1.1;
const labelWorld = new Vector3();
const camWorld = new Vector3();

/**
 * Chibi low-poly adventurer for one of the HEROES, tinted with hero.color.
 * The outer group (forwarded ref) carries position / rotationY / scale.
 */
export const HeroModel = forwardRef<Group, HeroModelProps>(function HeroModel(
  {
    heroId,
    name,
    position,
    rotationY = 0,
    moving = false,
    isSelf = false,
    scale = 1,
    showName = true,
    motionRef,
    labelSize = 1,
    showLabel = true,
    hideLabel = false,
    detail = "full",
  },
  ref,
) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const cape = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const tag = useRef<HTMLDivElement>(null);
  const tagScale = useRef(1);
  const tagEl = useRef<HTMLDivElement | null>(null);
  const walk = useRef(0); // 0 idle .. 1 walking (smoothed)
  const stride = useRef(0);

  useImperativeHandle(ref, () => root.current as Group, []);

  const hero = getHero(heroId);
  const look = getHeroLook(hero.id);
  const phase = hash01(`${hero.id}:${name ?? ""}`) * Math.PI * 2;
  const g = geo();
  const colors = { body: hero.color, sleeve: shade(hero.color, 0.78), robe: shade(hero.color, 0.62) };
  const lite = detail === "lite";
  const labelVisible = showLabel && !hideLabel;
  const labelY = look.headwear === "wizard-hat" ? 2.55 : 2.25;
  const distanceFactor = 9 * labelSize;

  useFrame((state, dt) => {
    const r = root.current;
    if (!r) return;
    let isMoving = moving;
    if (motionRef) {
      const m = motionRef.current;
      r.position.x = m.x;
      r.position.z = m.z;
      r.rotation.y = dampAngle(r.rotation.y, m.rotY, dampFactor(20, dt));
      isMoving = m.moving;
    }
    walk.current += ((isMoving ? 1 : 0) - walk.current) * dampFactor(10, dt);
    const w = walk.current;
    stride.current += dt * (6 + 5 * w) * (0.3 + 0.7 * w);
    const t = state.clock.elapsedTime + phase;
    const bob = Math.sin(t * 2.2) * 0.025 * (1 - w) + Math.abs(Math.sin(stride.current)) * 0.07 * w;

    // Cap the tag size when the camera is close (two-shot, countdown, finish screen).
    const el = tag.current;
    const cam = state.camera as PerspectiveCamera;
    if (el && cam.isPerspectiveCamera) {
      labelWorld.setFromMatrixPosition(r.matrixWorld);
      labelWorld.y += labelY * r.scale.y;
      const d = labelWorld.distanceTo(cam.getWorldPosition(camWorld));
      const dreiScale = distanceFactor / (2 * Math.tan(MathUtils.degToRad(cam.fov) / 2) * Math.max(0.01, d));
      const k = Math.min(1, (MAX_LABEL_SCALE * labelSize) / dreiScale);
      if (el !== tagEl.current || Math.abs(k - tagScale.current) > 0.01) {
        tagEl.current = el;
        tagScale.current = k;
        el.style.transform = k < 0.999 ? `scale(${k.toFixed(3)})` : "";
      }
    }

    if (lite) {
      // Lite LOD: just the idle breathe / walking hop; no limbs to animate.
      if (body.current) body.current.position.y = bob;
      return;
    }

    const swing = Math.sin(stride.current) * 0.75 * w;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) {
      armL.current.rotation.x = -swing * 0.8;
      armL.current.rotation.z = 0.12 + Math.sin(t * 1.6) * 0.03 * (1 - w);
    }
    if (armR.current) {
      armR.current.rotation.x = swing * 0.8;
      armR.current.rotation.z = -0.12 - Math.sin(t * 1.6) * 0.03 * (1 - w);
    }
    if (body.current) {
      body.current.position.y = bob;
      body.current.rotation.x = 0.1 * w;
    }
    if (cape.current) cape.current.rotation.x = 0.1 + w * 0.35 + Math.sin(t * 3) * 0.04;
    if (ring.current) {
      const p = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
      ring.current.scale.set(p, p, 1);
    }
  });

  const skin = mat(look.skin);
  const dark = mat(look.dark);
  const bodyMat = mat(colors.body, { glow: 0.12 });
  const sleeveMat = mat(colors.sleeve);
  const eyeMat = mat("#1a1024");

  return (
    <group
      ref={root}
      position={motionRef ? undefined : position}
      rotation-y={motionRef ? undefined : rotationY}
      scale={scale}
    >
      <mesh geometry={g.blob} material={blobMaterial()} rotation-x={-Math.PI / 2} position-y={0.012} renderOrder={1} />
      {isSelf && (
        <mesh ref={ring} geometry={g.ring} material={ringMaterial()} rotation-x={-Math.PI / 2} position-y={0.02} renderOrder={2} />
      )}

      {lite ? (
        <group ref={body}>
          <mesh geometry={g.liteBody} material={bodyMat} position-y={0.6} />
          <mesh geometry={g.head} material={skin} position-y={1.5} />
        </group>
      ) : (
        <group ref={body}>
          {/* legs (hip pivots) */}
          {[0.12, -0.12].map((x, i) => (
            <group key={x} ref={i === 0 ? legL : legR} position={[x, 0.5, 0]}>
              <mesh geometry={g.leg} material={dark} position-y={-0.2} />
              <mesh geometry={g.boot} material={mat(shade(look.dark, 0.7))} position={[0, -0.44, 0.04]} />
            </group>
          ))}

          {look.robe && <mesh geometry={g.robe} material={mat(colors.robe)} position-y={0.36} />}
          <mesh geometry={g.torso} material={bodyMat} position-y={0.83} />
          <mesh geometry={g.belt} material={mat(look.accent, { glow: 0.25 })} position-y={0.66} />
          {look.cape && (
            <group ref={cape} position={[0, 1.18, -0.24]}>
              {/* pivot at the shoulders; the cloth hangs below it */}
              <mesh position-y={-0.39} material={mat(look.cape)} geometry={box(0.5, 0.78, 0.04)} />
            </group>
          )}
          <BodyProp look={look} />

          {/* arms (shoulder pivots); +X = hero's left */}
          <group ref={armL} position={[0.33, 1.06, 0]}>
            <mesh geometry={g.arm} material={sleeveMat} position-y={-0.18} />
            <mesh geometry={g.hand} material={skin} position-y={-0.38} />
            <OffhandProp look={look} color={hero.color} />
          </group>
          <group ref={armR} position={[-0.33, 1.06, 0]}>
            <mesh geometry={g.arm} material={sleeveMat} position-y={-0.18} />
            <mesh geometry={g.hand} material={skin} position-y={-0.38} />
            <HandProp look={look} />
          </group>

          {/* head */}
          <group position-y={1.5}>
            <mesh geometry={g.head} material={skin} />
            <mesh geometry={g.eye} material={eyeMat} position={[0.105, 0.02, 0.27]} />
            <mesh geometry={g.eye} material={eyeMat} position={[-0.105, 0.02, 0.27]} />
            <Headwear look={look} color={hero.color} />
          </group>
        </group>
      )}

      {labelVisible && (
        <Html
          center
          position={[0, labelY, 0]}
          distanceFactor={distanceFactor}
          zIndexRange={[15, 0]}
          pointerEvents="none"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            ref={tag}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              whiteSpace: "nowrap",
              transformOrigin: "50% 100%",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 19,
                lineHeight: 1,
                background: "#150c22",
                border: `2px solid ${hero.color}`,
                boxShadow: `0 0 10px ${hero.color}66`,
              }}
            >
              {hero.emoji}
            </div>
            {showName && name ? (
              <div
                style={{
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: "16px",
                  padding: "1px 8px",
                  borderRadius: 999,
                  color: "#f4eeff",
                  background: "rgba(11,6,20,0.78)",
                  border: `1px solid ${isSelf ? "#ff6b2c" : "rgba(52,34,79,0.9)"}`,
                }}
              >
                {name}
              </div>
            ) : null}
          </div>
        </Html>
      )}
    </group>
  );
});
