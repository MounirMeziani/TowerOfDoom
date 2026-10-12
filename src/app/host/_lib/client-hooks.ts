// Small client-only stores for host pages: host keys in localStorage, page origin, fullscreen state.
import { useMemo, useSyncExternalStore } from "react";
import { getHostKey, normalizeSessionCode, saveHostKey } from "@/lib/player";

const HOST_KEY_PREFIX = "tod.host.";
const CHANGE_EVENT = "tod:hostkeys";

function subscribeHostKeys(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function notify() {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // ignore
  }
}

/** Saves a host key and notifies every useHostKey / useHostedCodes subscriber. */
export function storeHostKey(code: string, key: string) {
  saveHostKey(code, key);
  notify();
}

export function forgetHostKey(code: string) {
  const norm = normalizeSessionCode(code);
  if (!norm) return;
  try {
    window.localStorage.removeItem(HOST_KEY_PREFIX + norm);
  } catch {
    // ignore
  }
  notify();
}

/** The host key this browser holds for `code`, or null (always null during SSR / hydration). */
export function useHostKey(code: string): string | null {
  return useSyncExternalStore(
    subscribeHostKeys,
    () => getHostKey(code),
    () => null,
  );
}

function hostedCodesSnapshot(): string {
  try {
    const ls = window.localStorage;
    const codes: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(HOST_KEY_PREFIX)) {
        const code = normalizeSessionCode(k.slice(HOST_KEY_PREFIX.length));
        if (code) codes.push(code);
      }
    }
    return codes.sort().join(",");
  } catch {
    return "";
  }
}

/** Session codes this browser holds host keys for. */
export function useHostedCodes(): string[] {
  const snapshot = useSyncExternalStore(subscribeHostKeys, hostedCodesSnapshot, () => "");
  return useMemo(() => (snapshot ? snapshot.split(",") : []), [snapshot]);
}

const noopSubscribe = () => () => {};

/** window.location.origin on the client, "" during SSR. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

export function useIsFullscreen(): boolean {
  return useSyncExternalStore(
    subscribeFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false,
  );
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    // Fullscreen not allowed (e.g. iframe / iOS): ignore.
  }
}

/** Copies text to the clipboard with a textarea fallback. Resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
