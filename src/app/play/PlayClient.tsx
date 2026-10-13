"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CharacterCreator } from "@/components/character/CharacterCreator";
import { Game } from "@/components/game/Game";
import { PlayFrame, PlayLoader } from "@/components/game/PlayFrame";
import { Panel } from "@/components/ui/Panel";
import { useSessionStatus } from "@/lib/lobby";
import { getPlayer, savePlayer } from "@/lib/player";
import type { Player } from "@/lib/types";

const noopSubscribe = () => () => {};

/** true only after hydration on the client (player data lives in localStorage). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function PlayClient() {
  const hydrated = useHydrated();
  if (!hydrated) return <PlayLoader message="Loading" />;
  return <PlayGate />;
}

function PlayGate() {
  const [player, setPlayer] = useState<Player | null>(() => getPlayer());
  const [editing, setEditing] = useState(false);

  if (!player || !player.heroId || !player.name.trim() || editing) {
    return (
      <PlayFrame>
        <Panel className="flex flex-col gap-5">
          <h1 className="sr-only">{editing ? "Change your hero" : "Create your hero"}</h1>
          <CharacterCreator
            initial={player ?? undefined}
            sessionCode={player?.sessionCode ?? null}
            submitLabel="Go"
            onDone={(p) => {
              setPlayer(p);
              setEditing(false);
            }}
          />
        </Panel>
      </PlayFrame>
    );
  }

  return <SessionGate key={`${player.id}:${player.sessionCode ?? "solo"}`} player={player} onChangeHero={() => setEditing(true)} />;
}

function SessionGate({ player, onChangeHero }: { player: Player; onChangeHero: () => void }) {
  const code = player.sessionCode;
  const { session, loading, notFound } = useSessionStatus(code);

  // Unknown / deleted session: forget the code and play solo.
  useEffect(() => {
    if (code && notFound) savePlayer({ ...player, sessionCode: null });
  }, [code, notFound, player]);

  const effectiveCode = notFound ? null : code;
  if (effectiveCode && loading && !session) return <PlayLoader message={`Checking session ${effectiveCode}`} />;

  // The Game sends players back to the lobby while the session is still in "lobby" status,
  // and skips its intro when the session is already "playing".
  return (
    <Game
      player={player}
      sessionCode={effectiveCode}
      sessionStatus={effectiveCode ? (session?.status ?? null) : null}
      onChangeHero={onChangeHero}
    />
  );
}
