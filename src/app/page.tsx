import { Suspense } from "react";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import { HostCallout } from "@/components/landing/HostCallout";
import { JoinForm, JoinFormSkeleton } from "@/components/landing/JoinForm";
import { LandingIntro } from "@/components/landing/LandingIntro";
import { TwoAsGrid } from "@/components/landing/TwoAsGrid";
import { normalizeSessionCode } from "@/lib/player";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const rawCode = Array.isArray(params.s) ? params.s[0] : params.s;
  // Scan-the-QR path (?s=CODE): the character creator goes first so it sits above the fold on a phone.
  const joining = normalizeSessionCode(rawCode ?? "") !== null;

  const intro = (
    <div key="intro" className="mx-auto w-full max-w-xl lg:order-1 lg:max-w-none lg:pt-4">
      <LandingIntro joining={joining} />
    </div>
  );

  const join = (
    <section
      key="join"
      id="join"
      aria-labelledby="join-heading"
      className="mx-auto w-full max-w-xl scroll-mt-20 rounded-xl border-2 border-line bg-surface/90 p-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.03),inset_0_0_40px_-16px_var(--receiving),0_20px_60px_-30px_var(--ember)] sm:p-6 lg:order-2 lg:max-w-none"
    >
      <div className="mb-5 flex flex-col gap-1.5">
        <h2 id="join-heading" className="font-pixel text-sm text-ember-2 sm:text-base">
          Create your hero
        </h2>
        <p className="text-sm text-muted">
          {joining
            ? "Pick a name and a hero, then wait in the lobby for your host to start the climb."
            : "Pick a name and a hero. Your best run lands on the leaderboard."}
        </p>
      </div>
      <Suspense fallback={<JoinFormSkeleton />}>
        <JoinForm />
      </Suspense>
    </section>
  );

  return (
    <PageShell wide>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 lg:gap-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-12">
          {joining ? [join, intro] : [intro, join]}
        </div>

        <TwoAsGrid />

        <HostCallout />

        <footer className="flex flex-col gap-3 border-t-2 border-line pt-6 pb-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Footer">
            <ul className="-mx-2 flex flex-wrap">
              <li>
                <Link href="/leaderboard" className="flex min-h-11 items-center rounded px-2 hover:text-text">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/admin" className="flex min-h-11 items-center rounded px-2 hover:text-text">
                  Host a workshop session
                </Link>
              </li>
              <li>
                <Link href="/learn" className="flex min-h-11 items-center rounded px-2 hover:text-text">
                  Learn the 2 A&apos;s
                </Link>
              </li>
            </ul>
          </nav>
          <p className="text-xs">Built for Olsen Consulting&apos;s feedback workshops.</p>
        </footer>
      </div>
    </PageShell>
  );
}
