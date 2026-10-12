"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CharacterCreator } from "@/components/character/CharacterCreator";
import { getPlayer, normalizeSessionCode } from "@/lib/player";
import type { Player } from "@/lib/types";

const noopSubscribe = () => () => {};

/** True once we are rendering in the browser (false during SSR + hydration). */
function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Landing join flow: optional session code (from ?s=CODE or typed) + the character creator.
 * Must be rendered inside a <Suspense> boundary (it reads search params).
 */
export function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCode = normalizeSessionCode(searchParams.get("s") ?? "");
  const isClient = useIsClient();
  const stored: Player | null = isClient ? getPlayer() : null;

  const [codeInput, setCodeInput] = useState("");
  const [showCodeField, setShowCodeField] = useState(false);
  const codeFieldId = useId();
  const codeHintId = useId();

  const typedCode = normalizeSessionCode(codeInput);
  const code = urlCode ?? typedCode;
  const typedButInvalid = !urlCode && codeInput.trim().length > 0 && !typedCode;

  function handleDone() {
    if (code) router.push(`/lobby/${encodeURIComponent(code)}`);
    else router.push("/play");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {urlCode ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex min-h-9 items-center gap-2 rounded-full border-2 border-good/60 bg-good/10 px-3 py-1 text-sm text-text">
              <span aria-hidden="true" className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2.5 rounded-full bg-good" />
              </span>
              Joining session <strong className="font-pixel text-xs tracking-widest text-good">{urlCode}</strong>
            </p>
            <button
              type="button"
              onClick={() => router.replace("/", { scroll: false })}
              className="min-h-11 rounded px-2 text-sm text-muted underline underline-offset-4 hover:text-text"
            >
              Play solo instead
            </button>
          </div>
        ) : showCodeField ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={codeFieldId} className="font-pixel text-[0.625rem] text-muted uppercase">
              Session code (optional)
            </label>
            <input
              id={codeFieldId}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABCDE"
              aria-invalid={typedButInvalid || undefined}
              aria-describedby={codeHintId}
              className={`min-h-12 w-full rounded-md border-2 bg-surface-2 px-3 py-2 font-pixel text-sm tracking-[0.3em] text-text uppercase placeholder:text-muted/50 focus-visible:border-ember ${
                typedButInvalid ? "border-gold" : typedCode ? "border-good" : "border-line"
              }`}
            />
            <p id={codeHintId} className={`text-xs ${typedButInvalid ? "text-gold" : "text-muted"}`} aria-live="polite">
              {typedButInvalid
                ? "Codes are 4-8 letters or numbers. Leave it blank to climb solo."
                : typedCode
                  ? `You'll join session ${typedCode} and wait in the lobby.`
                  : "Ask your host for the code on the big screen."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            At a workshop?{" "}
            <button
              type="button"
              onClick={() => setShowCodeField(true)}
              className="min-h-11 font-semibold text-gold underline underline-offset-4 hover:text-ember-2"
            >
              Enter a session code
            </button>
          </p>
        )}
      </div>

      <CharacterCreator
        key={stored?.id ?? "new-hero"}
        initial={stored ?? undefined}
        sessionCode={code}
        submitLabel={code ? "Enter the Lobby" : "Climb the Tower"}
        onDone={handleDone}
      />
    </div>
  );
}

/** Same footprint as the form, shown while search params resolve. */
export function JoinFormSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-5 motion-reduce:animate-none">
      <div className="h-5 w-48 rounded bg-surface-2" />
      <div className="h-12 rounded-md bg-surface-2" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-16 rounded-md bg-surface-2 sm:h-32" />
        ))}
      </div>
      <div className="h-24 rounded-lg bg-surface-2" />
      <div className="h-13 rounded-md bg-ember/30" />
    </div>
  );
}
