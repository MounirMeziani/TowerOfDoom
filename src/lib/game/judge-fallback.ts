// Client-side judge used only when /api/judge is unreachable or returns something malformed, so the
// game never blocks. It runs the same deterministic heuristic the server uses (client-safe import:
// "@/lib/judge/heuristic", never the server-only "@/lib/judge" barrel), so an outage is not a free pass.
import { heuristicJudge } from "@/lib/judge/heuristic";
import type { JudgeResult, Mode } from "@/lib/types";

const OFFLINE_NOTE = "The AI judge was unavailable, so the quick judge graded this one.";

export function fallbackJudge(mode: Mode, answer: string): JudgeResult {
  const judged = heuristicJudge({ mode, answer });
  return { ...judged, feedback: `${OFFLINE_NOTE} ${judged.feedback}` };
}
