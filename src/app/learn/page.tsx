import type { Metadata } from "next";
import { ABadge } from "@/components/ui/ABadge";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";
import { LEARN_EXAMPLES } from "@/content/learn";
import { A_INFO, MODE_AS, type AKey, type Mode } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Learn the 2 A's",
  description:
    "Printable reference card for Olsen Consulting's 2 A's of Feedback: Assist + Actionable when giving, Appreciate + Accept or Decline when receiving.",
};

const SECTIONS: {
  mode: Mode;
  title: string;
  lead: string;
  text: string;
  border: string;
  chip: string;
  num: string;
}[] = [
  {
    mode: "giving",
    title: "Giving Feedback",
    lead: "When you share feedback, make it help and make it doable.",
    text: "text-giving",
    border: "border-giving/50",
    chip: "border-giving/50 bg-giving/10 text-giving",
    num: "bg-giving text-bg",
  },
  {
    mode: "receiving",
    title: "Receiving Feedback",
    lead: "When feedback comes your way, thank them, then decide for yourself.",
    text: "text-receiving",
    border: "border-receiving/50",
    chip: "border-receiving/50 bg-receiving/10 text-receiving",
    num: "bg-receiving text-bg",
  },
];

const CHECKLISTS: { title: string; mode: Mode; items: { text: string; a: AKey }[] }[] = [
  {
    title: "Before you speak",
    mode: "giving",
    items: [
      { text: "Am I trying to help them improve, or am I reacting out of frustration?", a: "assist" },
      { text: "Am I offering a constructive idea, not just pointing out what went wrong?", a: "assist" },
      { text: "Did I name a clear, concrete step they can actually take?", a: "actionable" },
      { text: "Could they act on it tomorrow without asking “but what do I do?”", a: "actionable" },
    ],
  },
  {
    title: "After you hear it",
    mode: "receiving",
    items: [
      { text: "Did I say “thank you”, even if it felt uncomfortable?", a: "appreciate" },
      { text: "Did I thank them even though I might disagree?", a: "appreciate" },
      { text: "Did I take time to reflect and weigh its value?", a: "acceptOrDecline" },
      { text: "Did I make my own choice about what to implement, and follow through?", a: "acceptOrDecline" },
    ],
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
      <div className="learn-card flex flex-col gap-10 print:gap-6">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <p className="font-pixel text-[0.625rem] text-gold uppercase">
            Olsen Consulting · Reference card
          </p>
          <h1 className="font-pixel text-lg leading-snug text-text sm:text-2xl">The 2 A&apos;s of Feedback</h1>
          <p className="max-w-prose text-base leading-relaxed text-muted">
            Two A&apos;s for <strong className="text-giving">giving</strong> feedback, two A&apos;s for{" "}
            <strong className="text-receiving">receiving</strong> it. Keep this card handy before your next
            one-on-one, review, or tricky hallway conversation.
          </p>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Button href="/" size="md">
              Climb the Tower <span aria-hidden="true">▲</span>
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
                      className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-semibold transition-colors hover:bg-surface-2 ${s.chip}`}
                    >
                      {A_INFO[a].label}
                    </a>
                  </li>
                )),
              )}
            </ul>
          </nav>
        </header>

        {/* The A's */}
        {SECTIONS.map((section) => (
          <section key={section.mode} aria-labelledby={`${section.mode}-heading`} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 id={`${section.mode}-heading`} className={`font-pixel text-sm sm:text-base ${section.text}`}>
                {section.title}
              </h2>
              <p className="text-sm text-muted">{section.lead}</p>
            </div>

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
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`grid size-8 shrink-0 place-items-center rounded-sm font-pixel text-xs print:border print:border-black ${section.num}`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 id={`${a}-title`} className="text-xl font-bold text-text sm:text-2xl">
                        {info.label}
                      </h3>
                      <p className={`font-pixel text-[0.625rem] uppercase ${section.text}`}>
                        {info.short}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-base leading-relaxed text-text">{info.description}</p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <figure className="print-border flex flex-col gap-2 rounded-lg border-2 border-bad/50 bg-bad/10 p-3">
                      <figcaption className="flex items-center gap-2 text-xs font-bold tracking-wide text-bad uppercase">
                        <span aria-hidden="true">✗</span> Doom move
                      </figcaption>
                      <blockquote className="text-sm leading-relaxed text-text">{ex.bad}</blockquote>
                    </figure>
                    <figure className="print-border flex flex-col gap-2 rounded-lg border-2 border-good/50 bg-good/10 p-3">
                      <figcaption className="flex items-center gap-2 text-xs font-bold tracking-wide text-good uppercase">
                        <span aria-hidden="true">✓</span> Hero move
                      </figcaption>
                      <blockquote className="text-sm leading-relaxed text-text">{ex.good}</blockquote>
                    </figure>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    <strong className="text-text">Why: </strong>
                    {ex.why}
                  </p>
                </article>
              );
            })}
          </section>
        ))}

        {/* Quick checklist */}
        <section aria-labelledby="checklist-heading" className="avoid-break flex flex-col gap-4">
          <h2 id="checklist-heading" className="font-pixel text-sm text-gold sm:text-base">
            Quick checklist
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CHECKLISTS.map((list) => (
              <div
                key={list.title}
                className={`print-border flex flex-col gap-3 rounded-xl border-2 bg-surface p-4 sm:p-5 ${
                  list.mode === "giving" ? "border-giving/50" : "border-receiving/50"
                }`}
              >
                <h3 className={`font-bold ${list.mode === "giving" ? "text-giving" : "text-receiving"}`}>
                  {list.title}
                  <span className="ml-2 text-xs font-medium text-muted">
                    ({list.mode === "giving" ? "giving" : "receiving"})
                  </span>
                </h3>
                <ul className="flex flex-col gap-3">
                  {list.items.map((item) => (
                    <li key={item.text} className="flex items-start gap-3 text-sm leading-relaxed text-text">
                      <span
                        aria-hidden="true"
                        className="print-border mt-0.5 inline-block size-4 shrink-0 rounded-[2px] border-2 border-muted"
                      />
                      <span className="flex flex-col items-start gap-1.5">
                        {item.text}
                        <ABadge a={item.a} className="print:border-black" />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          aria-labelledby="cta-heading"
          className="flex flex-col items-start gap-4 rounded-xl border-2 border-ember/50 bg-ember/10 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden"
        >
          <div className="flex flex-col gap-1">
            <h2 id="cta-heading" className="font-pixel text-xs text-ember-2 sm:text-sm">
              Ready to test it?
            </h2>
            <p className="text-sm text-muted">12 floors, 2 bosses, 3 hearts. See how far the 2 A&apos;s take you.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/" size="lg">
              Climb the Tower
            </Button>
            <Button href="/leaderboard" variant="secondary" size="lg">
              Leaderboard
            </Button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
