import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { AdminCreate } from "./AdminCreate";

// /admin: the facilitator's place to create and control sessions (/host shares the same backend).
export const metadata: Metadata = {
  title: "Admin",
  description: "Create and run a live Olsen Tower of Doom session.",
};

export default function AdminPage() {
  return (
    <PageShell>
      <AdminCreate />
    </PageShell>
  );
}
