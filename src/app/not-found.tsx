import type { Metadata } from "next";
import { TowerArt } from "@/components/brand/TowerArt";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "You fell off the tower",
};

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
        <div className="w-24 opacity-90 sm:w-32">
          <TowerArt floorsLit={0} />
        </div>
        <p className="font-pixel text-[0.625rem] text-bad uppercase">404 · Floor not found</p>
        <h1 className="font-pixel text-base leading-snug text-ember-2 sm:text-xl">You fell off the tower</h1>
        <p className="max-w-md text-muted">
          This floor doesn&apos;t exist, or the doom eye swallowed it. Dust yourself off and head back to the
          lobby doors.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button href="/" size="lg">
            Back to the tower
          </Button>
          <Button href="/learn" variant="secondary" size="lg">
            Learn the 2 A&apos;s
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
