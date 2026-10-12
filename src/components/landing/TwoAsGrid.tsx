import Link from "next/link";
import { A_INFO, MODE_AS, type Mode } from "@/lib/types";

const MODES: { mode: Mode; label: string; heading: string; card: string; dot: string }[] = [
  {
    mode: "giving",
    label: "When giving",
    heading: "text-giving",
    card: "border-giving/35 bg-giving/10 hover:border-giving hover:bg-giving/15",
    dot: "bg-giving",
  },
  {
    mode: "receiving",
    label: "When receiving",
    heading: "text-receiving",
    card: "border-receiving/35 bg-receiving/10 hover:border-receiving hover:bg-receiving/15",
    dot: "bg-receiving",
  },
];

/** Compact 2x2 "The 2 A's" grid: giving vs receiving, each card deep-links to /learn#<aKey>. */
export function TwoAsGrid() {
  return (
    <section aria-labelledby="two-as-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="two-as-heading" className="font-pixel text-xs text-text sm:text-sm">
          The 2 A&apos;s of Feedback
        </h2>
        <Link
          href="/learn"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-gold underline-offset-4 hover:underline"
        >
          Full reference card <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {MODES.map((m) => (
          <div key={m.mode} className="flex min-w-0 flex-col gap-2 sm:gap-3">
            <p className={`flex items-center gap-2 font-pixel text-[0.625rem] uppercase ${m.heading}`}>
              <span aria-hidden="true" className={`inline-block size-2 ${m.dot}`} />
              {m.label}
            </p>
            <ul className="grid gap-2 sm:gap-3 lg:grid-cols-2">
              {MODE_AS[m.mode].map((a) => (
                <li key={a} className="min-w-0">
                  <Link
                    href={`/learn#${a}`}
                    className={`flex h-full min-h-11 flex-col gap-1 rounded-lg border-2 p-3 transition-colors ${m.card}`}
                  >
                    <span className="font-semibold leading-tight text-text">{A_INFO[a].label}</span>
                    <span className="text-xs text-muted lg:hidden">{A_INFO[a].short}</span>
                    <span className="hidden text-sm leading-snug text-muted lg:block">{A_INFO[a].description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
