import { z } from "zod";

import { BOSS_FLOORS_CONTENT } from "@/content/floors";
import { clientIp, heuristicJudge, judge, rateLimit } from "@/lib/judge";
import type { JudgeRequest } from "@/lib/types";

export const maxDuration = 30;

// Only floorId + answer are trusted inputs. The scenario/task text sent to the model always comes from
// server content, so the paid model cannot be used as an open proxy or steered from the client.
// Older clients may still send mode/setup/prompt: setup/prompt are stripped (zod drops unknown keys) and
// mode is only used as a consistency check.
const JudgeRequestSchema = z.object({
  floorId: z.string().trim().min(1).max(100),
  mode: z.enum(["giving", "receiving"]).optional(),
  playerId: z.string().trim().max(100).optional(),
  answer: z
    .string()
    .trim()
    .min(1, "Write an answer first.")
    .max(600, "Keep your answer under 600 characters."),
});

// A whole workshop usually shares one public IP (office NAT) and one Fluid Compute instance, so per-IP
// limits are sized for a room, not a person.
const HARD_LIMIT_PER_IP = 600; // real hammering only -> 429
const AI_LIMIT_PER_IP = 120; // guards the paid model -> deterministic heuristic (200), never a 429
const AI_LIMIT_PER_PLAYER = 6; // one player resubmitting in a loop -> heuristic
const WINDOW_MS = 60_000;

function tooMany(retryAfterSec: number) {
  return Response.json(
    { error: "The judge needs a breather. Try again in a moment." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(request: Request) {
  const ip = clientIp(request.headers);

  const hard = rateLimit(`judge-hard:${ip}`, HARD_LIMIT_PER_IP, WINDOW_MS);
  if (!hard.ok) return tooMany(hard.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = JudgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request.";
    return Response.json({ error: msg }, { status: 400 });
  }

  const floor = BOSS_FLOORS_CONTENT.find((f) => f.id === parsed.data.floorId);
  if (!floor) return Response.json({ error: "Unknown floor." }, { status: 400 });
  if (parsed.data.mode && parsed.data.mode !== floor.mode) {
    return Response.json({ error: "Mode does not match this floor." }, { status: 400 });
  }

  const req: JudgeRequest = {
    floorId: floor.id,
    mode: floor.mode,
    setup: floor.setup,
    prompt: floor.prompt,
    answer: parsed.data.answer,
  };

  // Soft limits: when tripped, grade with the real server heuristic (status 200) instead of a 429,
  // so throttled players never land on the client's last-resort fallback.
  const room = rateLimit(`judge:${ip}`, AI_LIMIT_PER_IP, WINDOW_MS);
  const player = parsed.data.playerId
    ? rateLimit(`judge:${ip}:${parsed.data.playerId}`, AI_LIMIT_PER_PLAYER, WINDOW_MS)
    : null;
  if (!room.ok || (player && !player.ok)) return Response.json(heuristicJudge(req));

  try {
    return Response.json(await judge(req, request.signal));
  } catch {
    // judge() already falls back internally; this is a last line of defence.
    return Response.json(heuristicJudge(req));
  }
}
