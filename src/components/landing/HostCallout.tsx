import { Button } from "@/components/ui/Button";

const STEPS = [
  "Create a session in the admin console",
  "Project the join code + QR on the big screen",
  "Watch heroes gather in the lobby",
  "Press Start the Climb: everyone begins at once",
] as const;

/** Facilitator callout pointing to the admin console (/admin). */
export function HostCallout() {
  return (
    <section
      aria-labelledby="host-heading"
      className="grid gap-5 rounded-xl border-2 border-line bg-surface/80 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10"
    >
      <div className="flex flex-col gap-3">
        <p className="font-pixel text-[0.625rem] text-gold uppercase">For facilitators</p>
        <h2 id="host-heading" className="text-xl font-bold text-text sm:text-2xl">
          Running a workshop? You hold the keys.
        </h2>
        <ol className="grid gap-2 text-sm text-muted sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-sm border-2 border-line bg-surface-2 font-pixel text-[0.625rem] text-gold"
              >
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
        <Button href="/admin" size="lg">
          <span aria-hidden="true">🗝️</span> Open admin console
        </Button>
        <Button href="/leaderboard" variant="secondary" size="lg">
          Leaderboard
        </Button>
      </div>
    </section>
  );
}
