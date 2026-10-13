import type { Metadata } from "next";
import Link from "next/link";
import { TowerArt } from "@/components/brand/TowerArt";
import { buttonClasses } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";

export const metadata: Metadata = {
  title: "404",
};

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
        <div className="w-24 opacity-90 sm:w-32">
          <TowerArt floorsLit={0} />
        </div>
        <h1 className="font-pixel text-3xl text-ember-2 sm:text-5xl">
          404<span className="sr-only"> Page not found</span>
        </h1>
        <Link href="/" aria-label="Home" title="Home" className={buttonClasses({ size: "lg", className: "text-xl" })}>
          <span aria-hidden="true">🏠</span>
        </Link>
      </div>
    </PageShell>
  );
}
