import type { Metadata } from "next";
import Link from "next/link";
import { LiveLeaderboard } from "@/components/leaderboard/LiveLeaderboard";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { Panel } from "@/components/ui/Panel";
import { normalizeSessionCode } from "@/lib/player";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Live top scores from the Olsen Tower of Doom.",
};

async function findSessionName(code: string): Promise<string | null> {
  try {
    const { data } = await getServerSupabase().from("sessions").select("name").eq("code", code).maybeSingle();
    return typeof data?.name === "string" ? data.name : null;
  } catch {
    return null;
  }
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawCode = Array.isArray(params.s) ? params.s[0] : params.s;
  const requested = rawCode ? normalizeSessionCode(rawCode) : null;
  const sessionName = requested ? await findSessionName(requested) : null;
  const sessionCode = requested && sessionName !== null ? requested : null;

  return (
    <PageShell>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="flex min-w-0 items-center gap-2 font-pixel text-base leading-relaxed text-text sm:text-lg">
            <span aria-hidden="true">🏆</span>
            <span className="truncate">{sessionCode ? sessionName : "Leaderboard"}</span>
          </h1>
          {sessionCode && (
            <span className="rounded border-2 border-gold/50 px-2 py-1 font-pixel text-[0.625rem] text-gold">
              <span className="sr-only">Session </span>
              {sessionCode}
            </span>
          )}
          {rawCode && !sessionCode && (
            <p
              role="status"
              title="Session not found"
              className="rounded border-2 border-bad/50 bg-bad/10 px-2 py-1 font-pixel text-[0.625rem] text-bad"
            >
              <span aria-hidden="true">✗ </span>
              <span className="sr-only">No session found for code </span>
              {rawCode.slice(0, 16)}
            </p>
          )}
        </header>

        <Panel>
          <LiveLeaderboard
            sessionCode={sessionCode}
            limit={50}
            variant="compact"
            title={sessionCode ? "Session" : "Global"}
            hideTitle
          />
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <Button href="/play" size="lg">
            <span aria-hidden="true">▶</span> Play
          </Button>
          {sessionCode && (
            <Link
              href="/leaderboard"
              aria-label="Global leaderboard"
              title="Global"
              className="grid size-11 place-items-center rounded text-xl hover:bg-surface-2"
            >
              <span aria-hidden="true">🌐</span>
            </Link>
          )}
        </div>
      </div>
    </PageShell>
  );
}
