"use client";

import { useEffect } from "react";
import { TowerArt } from "@/components/brand/TowerArt";
import { Button } from "@/components/ui/Button";
import { useMode2D } from "@/lib/three/support";

/** App-level error boundary: retry, or drop to the 2D UI (a crashing 3D scene is the likely cause). */
export default function ErrorPage({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  reset: () => void;
}) {
  const [, setMode2d] = useMode2D();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-bg px-4 py-10 text-center text-text">
      <div className="w-24 opacity-90 sm:w-32">
        <TowerArt floorsLit={0} />
      </div>
      <h1 className="font-pixel text-2xl text-ember-2 sm:text-4xl">
        <span aria-hidden="true">⚠</span>
        <span className="sr-only">Something went wrong</span>
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" aria-label="Retry" title="Retry" onClick={() => retry()}>
          <span aria-hidden="true">↻</span>
        </Button>
        <Button
          size="lg"
          variant="secondary"
          aria-label="2D"
          title="2D"
          onClick={() => {
            setMode2d(true);
            reset();
          }}
        >
          2D
        </Button>
        <Button href="/" size="lg" variant="ghost" aria-label="Home" title="Home">
          <span aria-hidden="true">🏠</span>
        </Button>
      </div>
    </main>
  );
}
