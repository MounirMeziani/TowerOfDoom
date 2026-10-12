import "server-only";

import type { JudgeRequest, JudgeResult } from "@/lib/types";
import { aiConfigured, aiJudge } from "./ai";
import { heuristicJudge } from "./heuristic";

export { heuristicJudge } from "./heuristic";
export { clientIp, rateLimit } from "./rate-limit";

/** Try the AI judge; on ANY failure (timeout, auth, quota, bad output) fall back to the heuristic. */
export async function judge(req: JudgeRequest, signal?: AbortSignal): Promise<JudgeResult> {
  if (aiConfigured()) {
    try {
      const { scores, passed, feedback, source } = await aiJudge(req, { signal });
      return { scores, passed, feedback, source };
    } catch (err) {
      console.warn("[judge] AI judge failed, using heuristic:", err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }
  return heuristicJudge(req);
}
