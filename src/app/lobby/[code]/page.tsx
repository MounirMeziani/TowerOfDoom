import type { Metadata } from "next";
import { LobbyRoom } from "@/components/lobby/LobbyRoom";

interface LobbyPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: LobbyPageProps): Promise<Metadata> {
  const { code } = await params;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return { title: clean ? `Lobby ${clean}` : "Lobby", robots: { index: false } };
}

/** /lobby/[code]: the waiting room players see after creating their hero. */
export default async function LobbyPage({ params }: LobbyPageProps) {
  const { code } = await params;
  return <LobbyRoom rawCode={code} />;
}
