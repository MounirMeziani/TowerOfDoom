import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { normalizeSessionCode } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";
import type { SessionRow } from "@/lib/types";
import { HostSessionView } from "../_components/HostSessionView";

type Params = Promise<{ code: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SESSION_COLUMNS = "id, code, name, status, started_at, created_at";

/** undefined = lookup failed (let the client retry), null = no such session. */
async function loadSession(code: string): Promise<SessionRow | null | undefined> {
  try {
    const { data, error } = await getServerSupabase()
      .from("sessions")
      .select(SESSION_COLUMNS)
      .eq("code", code)
      .maybeSingle();
    if (error) return undefined;
    return (data as SessionRow | null) ?? null;
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const norm = normalizeSessionCode(code);
  return { title: norm ? `Session ${norm}` : "Session not found", robots: { index: false } };
}

export default async function HostSessionPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { code: rawCode } = await params;
  const query = await searchParams;
  const code = normalizeSessionCode(decodeURIComponent(rawCode));
  const session = code ? await loadSession(code) : null;

  if (!code || session === null) {
    return (
      <PageShell>
        <Panel className="flex flex-col items-start gap-4">
          <h1 className="font-pixel text-base leading-relaxed sm:text-xl">
            <span aria-hidden="true">❓ </span>
            <span className="sr-only">No session </span>
            <span className="text-gold">{(code ?? rawCode).slice(0, 16)}</span>
          </h1>
          <Button href="/host" size="lg">
            New session
          </Button>
        </Panel>
      </PageShell>
    );
  }

  const k = Array.isArray(query.k) ? query.k[0] : query.k;
  const keyFromUrl = typeof k === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(k) ? k : null;

  return (
    <HostSessionView code={code} initialSession={session ?? null} keyFromUrl={keyFromUrl} hadKeyParam={k !== undefined} />
  );
}
