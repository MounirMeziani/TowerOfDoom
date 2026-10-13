import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { STARTING_HEARTS } from "@/lib/game/constants";
import { LavaLayer } from "./LavaLayer";

/** Non-floor screens (intro, finished, creator): site chrome + the lava layer. */
export function PlayFrame({ children, hearts = STARTING_HEARTS }: { children: ReactNode; hearts?: number }) {
  return (
    <>
      <LavaLayer hearts={hearts} max={STARTING_HEARTS} />
      <div className="relative z-10">
        <PageShell>{children}</PageShell>
      </div>
    </>
  );
}

/** Small centered loader used while the session status loads or while redirecting (icon only; message is for screen readers). */
export function PlayLoader({ message = "Loading" }: { message?: string }) {
  return (
    <PageShell>
      <div role="status" aria-label={message} className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <span aria-hidden="true" className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block size-3 animate-pulse rounded-[2px] bg-ember"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      </div>
    </PageShell>
  );
}
