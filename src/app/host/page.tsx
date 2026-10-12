import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { HostCreate } from "./_components/HostCreate";

export const metadata: Metadata = {
  title: "Admin",
  description: "Create and run a live Olsen Tower of Doom workshop session.",
};

export default function HostPage() {
  return (
    <PageShell>
      <HostCreate />
    </PageShell>
  );
}
