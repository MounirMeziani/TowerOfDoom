"use client";

/**
 * Lightweight hooks with NO three.js imports, so non-3D pages can decide
 * between the 3D scene and the 2D fallback without pulling in the 3D bundle.
 * Import from "@/lib/three/support" in pages; the kit barrel re-exports them.
 */

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

let webglCached: boolean | undefined;

/**
 * Escape hatch for automated browsers (Playwright/headless use SwiftShader) and
 * manual testing: `?force3d` in the URL or localStorage "tod.force3d" = "1"
 * accept software GL instead of falling back to 2D.
 */
function allowSoftwareGL(): boolean {
  try {
    if (navigator.webdriver) return true;
    if (new URLSearchParams(window.location.search).has("force3d")) return true;
    return window.localStorage.getItem("tod.force3d") === "1";
  } catch {
    return false;
  }
}

function detectWebGL(): boolean {
  if (webglCached !== undefined) return webglCached;
  try {
    const canvas = document.createElement("canvas");
    // Software / blocklisted GL (SwiftShader, VMs, old Chromebooks) returns null
    // here, so those devices get the playable 2D UI by default.
    const opts: WebGLContextAttributes = allowSoftwareGL() ? {} : { failIfMajorPerformanceCaveat: true };
    const gl =
      (canvas.getContext("webgl2", opts) as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl", opts) as WebGLRenderingContext | null);
    webglCached = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglCached = false;
  }
  return webglCached;
}

/** true/false once known on the client; null during SSR and hydration. */
export function useWebGLSupport(): boolean | null {
  return useSyncExternalStore<boolean | null>(noopSubscribe, detectWebGL, () => null);
}

const MODE2D_KEY = "tod.mode2d";
const MODE2D_EVENT = "tod:mode2d";
let mode2dMemory = false; // used when localStorage is unavailable

function readMode2D(): boolean {
  try {
    const v = window.localStorage.getItem(MODE2D_KEY);
    return v === null ? mode2dMemory : v === "1";
  } catch {
    return mode2dMemory;
  }
}

function subscribeMode2D(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === MODE2D_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(MODE2D_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(MODE2D_EVENT, cb);
  };
}

/** Player preference for the 2D UI, persisted in localStorage "tod.mode2d". */
export function useMode2D(): [boolean, (b: boolean) => void] {
  const value = useSyncExternalStore(subscribeMode2D, readMode2D, () => false);
  const set = useCallback((b: boolean) => {
    mode2dMemory = b;
    try {
      window.localStorage.setItem(MODE2D_KEY, b ? "1" : "0");
    } catch {
      /* private mode: memory fallback above */
    }
    window.dispatchEvent(new Event(MODE2D_EVENT));
  }, []);
  return [value, set];
}

const coarseQuery = "(pointer: coarse)";

function subscribeCoarse(cb: () => void): () => void {
  const mq = window.matchMedia(coarseQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** true on touch-first devices (phones/tablets). */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(coarseQuery).matches,
    () => false,
  );
}

const RM_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeRM(cb: () => void): () => void {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** true when the user asked the OS/browser to minimise motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeRM,
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}
