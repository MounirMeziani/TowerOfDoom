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
  description: "Live top scores from the Olsen Tower of Doom, globally or for your workshop session.",
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
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-pixel text-[0.625rem] uppercase text-muted">
            {sessionCode ? `Session ${sessionCode}` : "Global"}
          </p>
          <h1 className="font-pixel text-base leading-relaxed text-text sm:text-xl">
            {sessionCode ? sessionName : "Hall of Heroes"}
          </h1>
          <p className="text-sm text-muted">
            {sessionCode
              ? "Best climb per hero in this workshop session. Updates live as runs finish."
              : "The best climbs in the whole tower, best run per hero. Updates live as runs finish."}
          </p>
          {rawCode && !sessionCode && (
            <p role="status" className="rounded-md border-2 border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold">
              No session found for code &ldquo;{rawCode.slice(0, 16)}&rdquo;. Showing the global leaderboard instead.
            </p>
          )}
        </header>

        <Panel>
          <LiveLeaderboard sessionCode={sessionCode} limit={50} variant="compact" />
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <Button href="/play" size="lg">
            Climb the Tower
          </Button>
          {sessionCode ? (
            <Link
              href="/leaderboard"
              className="flex min-h-11 items-center rounded px-2 text-sm font-medium text-muted underline-offset-4 hover:text-text hover:underline"
            >
              View global leaderboard
            </Link>
          ) : (
            <Link
              href="/learn"
              className="flex min-h-11 items-center rounded px-2 text-sm font-medium text-muted underline-offset-4 hover:text-text hover:underline"
            >
              Brush up on the 2 A&apos;s
            </Link>
          )}
        </div>
      </div>
    </PageShell>
  );
}
