import { MAX_SCORE } from "@/lib/game/constants";
import { bestRunPerPlayer, playerKey, type RankableRun } from "@/lib/leaderboard-core";
import { normalizeSessionCode } from "@/lib/player";
import { limitRequest } from "@/lib/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";
import { RunSchema } from "./_schema";

const noStore = { "Cache-Control": "no-store" };

// A workshop room usually shares one public IP (office NAT) and everyone finishes at about the same
// time, so the per-IP ceiling is room-sized. A tighter per-player cap still slows a single spammer.
const RUNS_PER_IP_PER_MIN = 300;
const RUNS_PER_PLAYER_PER_MIN = 10;

/** POST /api/runs  body RunSubmission -> { id, rank } */
export async function POST(req: Request) {
  const limited = limitRequest(req, "runs", RUNS_PER_IP_PER_MIN);
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }

  const parsed = RunSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
    return Response.json({ error: `Invalid run${where}: ${issue?.message ?? "bad data"}` }, { status: 400, headers: noStore });
  }
  const run = parsed.data;

  let sessionCode: string | null = null;
  if (run.sessionCode != null && run.sessionCode.trim() !== "") {
    sessionCode = normalizeSessionCode(run.sessionCode);
    if (!sessionCode) {
      return Response.json({ error: "Unknown session code." }, { status: 400, headers: noStore });
    }
  }

  // limitRequest appends the client IP, so this is per session + name + IP.
  const perPlayer = limitRequest(
    req,
    `runs-player:${sessionCode ?? "-"}:${run.playerName.toLowerCase()}`,
    RUNS_PER_PLAYER_PER_MIN,
  );
  if (perPlayer) return perPlayer;

  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (err) {
    console.error("[api/runs] Supabase not configured", err);
    return Response.json({ error: "The tower's database is not configured." }, { status: 500, headers: noStore });
  }

  if (sessionCode) {
    const { data: session, error } = await supabase.from("sessions").select("code").eq("code", sessionCode).maybeSingle();
    if (error) {
      console.error("[api/runs] session lookup failed", error.code, error.message);
      return Response.json({ error: "Could not record your run. Please try again." }, { status: 500, headers: noStore });
    }
    if (!session) {
      return Response.json({ error: "Unknown session code." }, { status: 400, headers: noStore });
    }
  }

  // Backstop: the schema already rejects scores above what the run could reach.
  const score = Math.max(0, Math.min(MAX_SCORE, Math.round(run.score)));
  const durationMs = Math.round(run.durationMs);
  const playerId = run.playerId ?? null;

  const { data: inserted, error: insertError } = await supabase
    .from("runs")
    .insert({
      session_code: sessionCode,
      player_name: run.playerName,
      player_id: playerId,
      avatar: run.heroId,
      score,
      floors_cleared: run.floorsCleared,
      total_floors: run.totalFloors,
      hearts_left: run.heartsLeft,
      duration_ms: durationMs,
      outcome: run.outcome,
      a_stats: run.aStats,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("[api/runs] insert failed", insertError?.code, insertError?.message);
    return Response.json({ error: "Could not record your run. Please try again." }, { status: 500, headers: noStore });
  }

  const rank = await rankOf(supabase, sessionCode, {
    id: String(inserted.id),
    player_name: run.playerName,
    player_id: playerId,
    score,
    created_at: String(inserted.created_at),
  });

  return Response.json({ id: inserted.id as string, rank }, { status: 201, headers: noStore });
}

type RankRow = RankableRun & { id: string };

/**
 * Rank exactly as the leaderboards show it: best run per player, score desc then earliest first.
 * Only runs scoring >= this one can rank above (or tie with) it, so only those are fetched.
 * If the player has an earlier, better run, this is that best run's rank, which is what the board shows.
 */
async function rankOf(
  supabase: ReturnType<typeof getServerSupabase>,
  sessionCode: string | null,
  mine: RankRow,
): Promise<number | null> {
  let query = supabase
    .from("runs")
    .select("id, player_name, player_id, score, created_at")
    .gte("score", mine.score)
    .order("score", { ascending: false })
    .limit(5000);
  if (sessionCode) query = query.eq("session_code", sessionCode);
  const { data, error } = await query;
  if (error) {
    console.error("[api/runs] rank query failed", error.code, error.message);
    return null;
  }
  const rows: RankRow[] = (data ?? []).map((r) => ({
    id: String(r.id),
    player_name: String(r.player_name),
    player_id: typeof r.player_id === "string" && r.player_id ? r.player_id : null,
    score: Number(r.score),
    created_at: String(r.created_at),
  }));
  if (!rows.some((r) => r.id === mine.id)) rows.push(mine);
  const key = playerKey(mine);
  const index = bestRunPerPlayer(rows).findIndex((r) => playerKey(r) === key);
  return index >= 0 ? index + 1 : null;
}
