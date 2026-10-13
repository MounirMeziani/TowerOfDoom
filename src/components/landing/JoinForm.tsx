"use client";

import { useState, useSyncExternalStore } from "react";
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

  const typedCode = normalizeSessionCode(codeInput);
  const code = urlCode ?? typedCode;
  const typedButInvalid = !urlCode && codeInput.trim().length > 0 && !typedCode;

  function handleDone() {
    if (code) router.push(`/lobby/${encodeURIComponent(code)}`);
    else router.push("/play");
  }

  return (
    <div className="flex flex-col gap-4">
      {urlCode ? (
        <div className="flex items-center gap-2">
          <p
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-good/60 bg-good/10 px-3 text-text"
            aria-label={`Session ${urlCode}`}
          >
            <span aria-hidden="true" className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-good" />
            </span>
            <strong className="font-pixel text-xs tracking-widest text-good">{urlCode}</strong>
          </p>
          <button
            type="button"
            onClick={() => router.replace("/", { scroll: false })}
            aria-label="Play solo instead"
            title="Solo"
            className="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ) : showCodeField ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="CODE"
            aria-label="Session code (optional, 4-8 letters or numbers)"
            aria-invalid={typedButInvalid || undefined}
            autoFocus
            className={`min-h-12 w-full rounded-md border-2 bg-surface-2 px-3 py-2 font-pixel text-sm tracking-[0.3em] text-text uppercase placeholder:text-muted/50 focus-visible:border-ember ${
              typedButInvalid ? "border-bad" : typedCode ? "border-good" : "border-line"
            }`}
          />
          <span aria-hidden="true" className={`w-8 shrink-0 text-center text-lg ${typedCode ? "text-good" : "text-bad"}`}>
            {typedCode ? "✓" : typedButInvalid ? "✗" : ""}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCodeField(true)}
          aria-label="Enter a session code"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border-2 border-dashed border-line px-3 font-pixel text-[0.625rem] text-gold uppercase hover:border-gold"
        >
          <span aria-hidden="true">🔑</span> Code
        </button>
      )}

      <CharacterCreator
        key={stored?.id ?? "new-hero"}
        initial={stored ?? undefined}
        sessionCode={code}
        submitLabel={code ? "Join" : "Go"}
        onDone={handleDone}
      />
    </div>
  );
}

/** Same footprint as the form, shown while search params resolve. */
export function JoinFormSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none">
      <div className="h-11 w-24 rounded bg-surface-2" />
      <div className="h-12 rounded-md bg-surface-2" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-20 rounded-md bg-surface-2" />
        ))}
      </div>
      <div className="h-13 rounded-md bg-ember/30" />
    </div>
  );
}
