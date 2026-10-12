import { handleAdminAction, type CodeContext } from "../_session";

export const runtime = "nodejs";

/** POST /api/sessions/[code]/end  body { hostKey } -> SessionRow (status "ended"; idempotent). */
export function POST(req: Request, ctx: CodeContext) {
  return handleAdminAction(req, ctx, "end", (current) =>
    current.status === "ended" ? null : { status: "ended", started_at: current.started_at },
  );
}
