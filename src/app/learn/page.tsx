import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { LEARN_EXAMPLES } from "@/content/learn";
import { A_INFO, MODE_AS, type Mode } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Learn the 2 A's",
  description:
    "The 2 A's of Feedback: Assist + Actionable when giving, Appreciate + Accept or Decline when receiving.",
};

const SECTIONS: {
  mode: Mode;
  icon: string;
  title: string;
  text: string;
  border: string;
  chip: string;
  num: string;
}[] = [
  {
    mode: "giving",
    icon: "🗣",
    title: "Giving",
    text: "text-giving",
    border: "border-giving/50",
    chip: "border-giving/50 bg-giving/10 text-giving",
    num: "bg-giving text-bg",
  },
  {
    mode: "receiving",
    icon: "👂",
    title: "Receiving",
    text: "text-receiving",
    border: "border-receiving/50",
    chip: "border-receiving/50 bg-receiving/10 text-receiving",
    num: "bg-receiving text-bg",
  },
];

const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  html, body, .doom-bg { background: #fff !important; color: #000 !important; }
  .learn-card, .learn-card * {
    color: #000 !important;
    background: transparent !important;
    box-shadow: none !important;
    text-shadow: none !important;
    filter: none !important;
  }
  .learn-card .print-border { border-color: #888 !important; }
  .learn-card .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  .learn-card a { text-decoration: none !important; }
}
`;

export default function LearnPage() {
  return (
    <PageShell>
      <style>{PRINT_CSS}</style>
      <div className="learn-card flex flex-col gap-8 print:gap-6">
        <header className="flex flex-col gap-4">
          <h1 className="font-pixel text-lg leading-snug text-text sm:text-2xl">The 2 A&apos;s of Feedback</h1>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button href="/" size="md">
              <span aria-hidden="true">▶</span> Play
            </Button>
            <PrintButton />
          </div>
          <nav aria-label="Jump to an A" className="print:hidden">
            <ul className="flex flex-wrap gap-2">
              {SECTIONS.flatMap((s) =>
                MODE_AS[s.mode].map((a) => (
                  <li key={a}>
                    <a
                      href={`#${a}`}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold transition-colors hover:bg-surface-2 ${s.chip}`}
                    >
                      <span aria-hidden="true">{s.icon}</span>
                      {A_INFO[a].label}
                    </a>
                  </li>
                )),
              )}
            </ul>
          </nav>
        </header>

        {SECTIONS.map((section) => (
          <section key={section.mode} aria-labelledby={`${section.mode}-heading`} className="flex flex-col gap-4">
            <h2
              id={`${section.mode}-heading`}
              className={`flex items-center gap-2 font-pixel text-sm sm:text-base ${section.text}`}
            >
              <span aria-hidden="true">{section.icon}</span>
              {section.title}
            </h2>

            {MODE_AS[section.mode].map((a, i) => {
              const info = A_INFO[a];
              const ex = LEARN_EXAMPLES[a];
              return (
                <article
                  key={a}
                  id={a}
                  aria-labelledby={`${a}-title`}
                  className={`avoid-break print-border scroll-mt-24 rounded-xl border-2 bg-surface p-4 sm:p-6 ${section.border}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`grid size-8 shrink-0 place-items-center rounded-sm font-pixel text-xs print:border print:border-black ${section.num}`}
                    >
                      {i + 1}
                    </span>
                    <h3 id={`${a}-title`} className="min-w-0 text-xl font-bold text-text sm:text-2xl">
                      {info.label}
                    </h3>
                  </div>

                  <p className="mt-4 text-base leading-relaxed text-text">{info.description}</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <figure className="print-border flex items-start gap-2 rounded-lg border-2 border-bad/50 bg-bad/10 p-3">
                      <figcaption className="text-lg leading-none font-bold text-bad">
                        <span aria-hidden="true">✗</span>
                        <span className="sr-only">Don&apos;t:</span>
                      </figcaption>
                      <blockquote className="text-sm leading-relaxed text-text">{ex.bad}</blockquote>
                    </figure>
                    <figure className="print-border flex items-start gap-2 rounded-lg border-2 border-good/50 bg-good/10 p-3">
                      <figcaption className="text-lg leading-none font-bold text-good">
                        <span aria-hidden="true">✓</span>
                        <span className="sr-only">Do:</span>
                      </figcaption>
                      <blockquote className="text-sm leading-relaxed text-text">{ex.good}</blockquote>
                    </figure>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
