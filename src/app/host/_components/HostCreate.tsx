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
      <Panel as="section" aria-labelledby={`${nameId}-h`}>
        <h1 id={`${nameId}-h`} className="mb-4 font-pixel text-sm uppercase text-ember-2 sm:text-base">
          New session
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor={nameId} className="sr-only">
              Session name
            </label>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
              maxLength={MAX_NAME}
              placeholder="Name"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-h-11 rounded-md border-2 border-line bg-surface-2 px-3 py-2 text-base text-text placeholder:text-muted/70 focus-visible:border-ember"
            />
          </div>
          {error && (
            <p id={errorId} role="alert" title={error} className="text-sm text-bad">
              <span aria-hidden="true">✗</span>
              <span className="sr-only">{error}</span>
            </p>
          )}
          <div>
            <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined}>
              {busy ? "⏳" : "Create"}
            </Button>
          </div>
        </form>
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
        Sessions
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
                <span className="truncate text-sm text-text">{row?.name ?? (rows ? "?" : "")}</span>
              </Link>
              {row && <StatusPill status={row.status} />}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Forget ${code}?`)) forgetHostKey(code);
                }}
                aria-label={`Forget ${code}`}
                title="Forget"
                className="min-h-11 min-w-11 rounded px-2 text-base text-muted hover:text-bad"
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
