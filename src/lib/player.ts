// Local player identity + host keys, persisted in localStorage. SSR-safe: every access is guarded.
import type { Player } from "./types";

const PLAYER_KEY = "tod.player";
const HOST_KEY_PREFIX = "tod.host.";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through (insecure context)
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Uppercase, strip non A-Z0-9; returns null unless 4-8 chars remain. */
export function normalizeSessionCode(raw: string): string | null {
  const code = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 4 && code.length <= 8 ? code : null;
}

export function getPlayer(): Player | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(PLAYER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Player> | null;
    if (!data || typeof data.id !== "string" || typeof data.name !== "string" || typeof data.heroId !== "string") {
      return null;
    }
    const sessionCode = typeof data.sessionCode === "string" ? normalizeSessionCode(data.sessionCode) : null;
    return { id: data.id, name: data.name, heroId: data.heroId, sessionCode };
  } catch {
    return null;
  }
}

/** Saves the player, keeping the existing id (argument id, then stored id) or creating a new one. */
export function savePlayer(p: Omit<Player, "id"> & { id?: string }): Player {
  const id = p.id ?? getPlayer()?.id ?? randomId();
  const player: Player = {
    id,
    name: p.name.trim().slice(0, 24),
    heroId: p.heroId,
    sessionCode: p.sessionCode ? normalizeSessionCode(p.sessionCode) : null,
  };
  const ls = storage();
  if (ls) {
    try {
      ls.setItem(PLAYER_KEY, JSON.stringify(player));
    } catch {
      // storage full / blocked: keep going in-memory
    }
  }
  return player;
}

export function getHostKey(code: string): string | null {
  const ls = storage();
  const norm = normalizeSessionCode(code);
  if (!ls || !norm) return null;
  try {
    return ls.getItem(HOST_KEY_PREFIX + norm);
  } catch {
    return null;
  }
}

export function saveHostKey(code: string, key: string): void {
  const ls = storage();
  const norm = normalizeSessionCode(code);
  if (!ls || !norm) return;
  try {
    ls.setItem(HOST_KEY_PREFIX + norm, key);
  } catch {
    // ignore
  }
}
