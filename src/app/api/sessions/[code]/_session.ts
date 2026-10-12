import "server-only";

import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { limitRequest } from "@/lib/rate-limit";
import { normalizeSessionCode } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import type { SessionRow, SessionStatus } from "@/lib/types";

/** Public columns only. host_key is never selected into a response. */
export const PUBLIC_COLUMNS = "id, code, name, status, started_at, created_at";

export const noStore = { "Cache-Control": "no-store" } as const;

export interface CodeContext {
  params: Promise<{ code: string }>;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: noStore });
}

/** Strict code check: the raw param must already be a canonical code (case-insensitive). */
export function parseCode(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9]{4,8}$/.test(decoded)) return null;
  return normalizeSessionCode(decoded);
}

export function toSessionRow(data: Record<string, unknown>): SessionRow {
  return {
    id: String(data.id),
    code: String(data.code),
    name: String(data.name),
    status: data.status as SessionStatus,
    started_at: (data.started_at as string | null) ?? null,
    created_at: String(data.created_at),
  };
}

/** Constant-time comparison of two secrets (hashing-free; length mismatch returns false without early exit on content). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Compare against itself so the timing does not depend on where the strings differ.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

const AdminBody = z.object({ hostKey: z.string().min(1).max(256) });

type Transition = (current: SessionRow) => { status: SessionStatus; started_at: string | null } | null;

/**
 * Shared handler for admin powers (start / end / reset): rate limit, validate code + body,
 * verify the host key in constant time, then apply the transition (null transition = no-op, idempotent).
 */
export async function handleAdminAction(
  req: Request,
  ctx: CodeContext,
  action: "start" | "end" | "reset",
  transition: Transition,
): Promise<Response> {
  const limited = limitRequest(req, `session-${action}`, 30);
  if (limited) return limited;

  const { code: rawCode } = await ctx.params;
  const code = parseCode(rawCode);
  if (!code) return jsonError("That session code doesn't look right.", 400);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  const parsed = AdminBody.safeParse(raw);
  if (!parsed.success) return jsonError("The admin key is missing.", 400);

  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (err) {
    console.error(`[api/sessions/${action}] Supabase not configured`, err);
    return jsonError("The tower's database is not configured.", 500);
  }

  const { data, error } = await supabase
    .from("sessions")
    .select(`${PUBLIC_COLUMNS}, host_key`)
    .eq("code", code)
    .maybeSingle();
  if (error) {
    console.error(`[api/sessions/${action}] lookup failed`, error.code, error.message);
    return jsonError("Could not load the session. Please try again.", 500);
  }
  if (!data) return jsonError("That session doesn't exist.", 404);

  const hostKey = typeof data.host_key === "string" ? data.host_key : "";
  if (!hostKey || !safeEqual(parsed.data.hostKey, hostKey)) {
    return jsonError("Only the admin of this session can do that.", 403);
  }

  const current = toSessionRow(data);
  const next = transition(current);
  if (!next) return Response.json(current, { headers: noStore });

  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update(next)
    .eq("id", current.id)
    .select(PUBLIC_COLUMNS)
    .single();
  if (updateError || !updated) {
    console.error(`[api/sessions/${action}] update failed`, updateError?.code, updateError?.message);
    return jsonError("Could not update the session. Please try again.", 500);
  }
  return Response.json(toSessionRow(updated), { headers: noStore });
}
