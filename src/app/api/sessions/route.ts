import { z } from "zod";
import { limitRequest } from "@/lib/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";

// Unambiguous alphabet: no 0/O, 1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const MAX_ATTEMPTS = 5;

const BodySchema = z.object({
  name: z
    .string()
    .optional()
    .transform((v) => (v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(60, "Session name must be 60 characters or fewer.")),
});

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return code;
}

const noStore = { "Cache-Control": "no-store" };

/** POST /api/sessions  body { name?: string } -> { code, name, hostKey } */
export async function POST(req: Request) {
  const limited = limitRequest(req, "sessions", 10);
  if (limited) return limited;

  let raw: unknown = {};
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400, headers: noStore });
  }

  const parsed = BodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid session details." },
      { status: 400, headers: noStore },
    );
  }
  const name = parsed.data.name || "Tower Session";

  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (err) {
    console.error("[api/sessions] Supabase not configured", err);
    return Response.json({ error: "The tower's database is not configured." }, { status: 500, headers: noStore });
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ code, name })
      .select("code, name, host_key")
      .single();

    if (!error && data) {
      return Response.json(
        { code: data.code as string, name: data.name as string, hostKey: data.host_key as string },
        { status: 201, headers: noStore },
      );
    }
    if (error?.code === "23505") continue; // unique violation on code: roll again
    console.error("[api/sessions] insert failed", error?.code, error?.message);
    return Response.json({ error: "Could not create the session. Please try again." }, { status: 500, headers: noStore });
  }

  return Response.json({ error: "Could not find a free session code. Please try again." }, { status: 503, headers: noStore });
}
