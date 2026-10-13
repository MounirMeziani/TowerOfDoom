import { Suspense } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { JoinForm, JoinFormSkeleton } from "@/components/landing/JoinForm";
import { LandingIntro } from "@/components/landing/LandingIntro";
import { TwoAsGrid } from "@/components/landing/TwoAsGrid";

export default function Home() {
  return (
    <PageShell wide>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 lg:gap-12">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12">
          <LandingIntro />
          <section
            id="join"
            aria-label="Create your hero"
            className="mx-auto w-full max-w-xl scroll-mt-20 rounded-xl border-2 border-line bg-surface/90 p-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.03),inset_0_0_40px_-16px_var(--receiving),0_20px_60px_-30px_var(--ember)] sm:p-5 lg:max-w-none"
          >
            <Suspense fallback={<JoinFormSkeleton />}>
              <JoinForm />
            </Suspense>
          </section>
        </div>

        <TwoAsGrid />
      </div>
    </PageShell>
  );
}
