import { handleAdminAction, type CodeContext } from "../_session";

export const runtime = "nodejs";

/** POST /api/sessions/[code]/reset  body { hostKey } -> SessionRow (status "lobby", started_at null; idempotent). */
export function POST(req: Request, ctx: CodeContext) {
  return handleAdminAction(req, ctx, "reset", (current) =>
    current.status === "lobby" && current.started_at === null ? null : { status: "lobby", started_at: null },
  );
}
