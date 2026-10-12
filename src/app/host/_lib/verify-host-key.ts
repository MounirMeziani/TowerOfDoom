"use server";

import { headers } from "next/headers";
import { parseCode, safeEqual } from "@/app/api/sessions/[code]/_session";
import { rateLimit } from "@/lib/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";

export type HostKeyCheck = "ok" | "invalid" | "unknown";

/**
 * Checks an admin link's key against the session before the browser saves it, so a stale or
 * mistyped ?k= link never replaces a working key. Never returns the stored key.
 * "invalid" = wrong key or unknown session; "unknown" = could not check (rate limit, DB down).
 */
export async function verifyHostKey(code: string, hostKey: string): Promise<HostKeyCheck> {
  if (typeof code !== "string" || typeof hostKey !== "string") return "invalid";
  if (!hostKey || hostKey.length > 256) return "invalid";
  const norm = parseCode(code);
  if (!norm) return "invalid";

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  if (!rateLimit(`session-verify:${ip}`, 30, 60_000).ok) return "unknown";

  let supabase;
  try {
    supabase = getServerSupabase();
  } catch {
    return "unknown";
  }
  const { data, error } = await supabase.from("sessions").select("host_key").eq("code", norm).maybeSingle();
  if (error) {
    console.error("[host/verify] lookup failed", error.code, error.message);
    return "unknown";
  }
  if (!data) return "invalid";
  const stored = typeof data.host_key === "string" ? data.host_key : "";
  return stored && safeEqual(hostKey, stored) ? "ok" : "invalid";
}
