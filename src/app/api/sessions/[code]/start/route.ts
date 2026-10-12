import { handleAdminAction, type CodeContext } from "../_session";

export const runtime = "nodejs";

/** POST /api/sessions/[code]/start  body { hostKey } -> SessionRow (status "playing"; idempotent). */
export function POST(req: Request, ctx: CodeContext) {
  return handleAdminAction(req, ctx, "start", (current) =>
    current.status === "playing" ? null : { status: "playing", started_at: new Date().toISOString() },
  );
}
