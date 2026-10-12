"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { createSession } from "@/lib/api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { SessionRow } from "@/lib/types";
import { forgetHostKey, storeHostKey, useHostedCodes } from "../_lib/client-hooks";
import { StatusPill } from "./StatusPill";

const MAX_NAME = 60;

/** Admin landing: create a workshop session, or jump back into one this browser controls. */
export function HostCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const errorId = useId();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createSession(name.trim() || "Tower Session");
      storeHostKey(created.code, created.hostKey);
      router.push(`/host/${created.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the session.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="font-pixel text-[0.625rem] uppercase text-ember">Admin</p>
        <h1 className="font-pixel text-base leading-relaxed text-text sm:text-xl">Admin: run a workshop session</h1>
        <p className="max-w-prose text-muted">
          Create a session, put it on the projector, and let your team scan in with their phones. You control when the
          climb begins.
        </p>
      </header>

      <Panel as="section" aria-labelledby={`${nameId}-h`}>
        <h2 id={`${nameId}-h`} className="mb-4 font-pixel text-xs uppercase text-ember-2">
          New session
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor={nameId} className="font-pixel text-[0.625rem] uppercase text-muted">
              Session name
            </label>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
              maxLength={MAX_NAME}
              placeholder="e.g. Finance Team Workshop, Oct 12"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-h-11 rounded-md border-2 border-line bg-surface-2 px-3 py-2 text-base text-text placeholder:text-muted/70 focus-visible:border-ember"
            />
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <div>
            <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Opening the tower..." : "Create session"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel as="section" aria-label="How it works">
        <ol className="grid gap-3 text-sm text-muted sm:grid-cols-2">
          {[
            ["1", "Create a session. You become its admin on this device."],
            ["2", "Put the session page on the projector. It shows a join code and a QR code."],
            ["3", "Players scan in, create a hero, and wait in the lobby."],
            ["4", "Press Start the Climb. Everyone starts together, and the race and team mastery update live."],
          ].map(([n, text]) => (
            <li key={n} className="flex gap-3">
              <span className="font-pixel text-xs text-ember">{n}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">
          Running the controls from another device? Use <strong className="text-text">Copy admin link</strong> on the
          session page and open it there.
        </p>
      </Panel>

      <HostedSessions />
    </div>
  );
}

function HostedSessions() {
  const codes = useHostedCodes();
  const codesKey = codes.join(",");
  const [sessions, setSessions] = useState<{ key: string; rows: SessionRow[] } | null>(null);

  useEffect(() => {
    if (!codesKey) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await getBrowserSupabase()
          .from("sessions")
          .select("id, code, name, status, started_at, created_at")
          .in("code", codesKey.split(","))
          .order("created_at", { ascending: false });
        if (cancelled || error) return;
        setSessions({ key: codesKey, rows: (data ?? []) as SessionRow[] });
      } catch {
        // offline or not configured: fall back to bare codes
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codesKey]);

  if (codes.length === 0) return null;
  const rows = sessions?.key === codesKey ? sessions.rows : null;
  const byCode = new Map((rows ?? []).map((r) => [r.code, r]));
  const ordered = rows ? [...rows.map((r) => r.code), ...codes.filter((c) => !byCode.has(c))] : codes;

  return (
    <Panel as="section" aria-labelledby="hosted-sessions-h">
      <h2 id="hosted-sessions-h" className="mb-4 font-pixel text-xs uppercase text-ember-2">
        Your sessions
      </h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((code) => {
          const row = byCode.get(code);
          return (
            <li
              key={code}
              className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-line bg-surface-2 px-3 py-2"
            >
              <Link
                href={`/host/${code}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded hover:text-ember-2"
              >
                <span className="font-pixel text-xs text-gold">{code}</span>
                <span className="truncate text-sm text-text">{row?.name ?? (rows ? "Session not found" : "")}</span>
              </Link>
              {row && <StatusPill status={row.status} />}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Forget admin access to ${code} on this device?`)) forgetHostKey(code);
                }}
                className="min-h-11 rounded px-2 text-xs text-muted hover:text-bad"
              >
                Forget
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
