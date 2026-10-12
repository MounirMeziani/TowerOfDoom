import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { HostCreate } from "../host/_components/HostCreate";

// /admin is an alias of /host: the facilitator's place to create and control sessions.
export const metadata: Metadata = {
  title: "Admin",
  description: "Create and run a live Olsen Tower of Doom workshop session.",
};

export default function AdminPage() {
  return (
    <PageShell>
      <HostCreate />
    </PageShell>
  );
}
