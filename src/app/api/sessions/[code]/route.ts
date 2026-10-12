import { limitRequest } from "@/lib/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";
import { PUBLIC_COLUMNS, jsonError, noStore, parseCode, toSessionRow, type CodeContext } from "./_session";

export const runtime = "nodejs";

/** GET /api/sessions/[code] -> public SessionRow, or 404. */
export async function GET(req: Request, ctx: CodeContext) {
  // Abuse protection only. Each lobby client polls about 30x/min (every 2s, plus focus/visibility and
  // broadcast-triggered refetches), host views poll too, and a whole workshop room often shares one
  // office NAT IP. 10k/min fits 150+ such clients with room to spare; it's a cheap read of public
  // columns. Responses stay no-store: this read confirms realtime "status" broadcasts, so a cached
  // "lobby" right after the start would delay every player.
  const limited = limitRequest(req, "session-get", 10_000);
  if (limited) return limited;

  const { code: rawCode } = await ctx.params;
  const code = parseCode(rawCode);
  if (!code) return jsonError("That session doesn't exist.", 404);

  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (err) {
    console.error("[api/sessions/get] Supabase not configured", err);
    return jsonError("The tower's database is not configured.", 500);
  }

  const { data, error } = await supabase.from("sessions").select(PUBLIC_COLUMNS).eq("code", code).maybeSingle();
  if (error) {
    console.error("[api/sessions/get] lookup failed", error.code, error.message);
    return jsonError("Could not load the session. Please try again.", 500);
  }
  if (!data) return jsonError("That session doesn't exist.", 404);
  return Response.json(toSessionRow(data), { headers: noStore });
}
