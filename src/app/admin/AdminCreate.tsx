"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { createSession } from "@/lib/api";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { SessionRow, SessionStatus } from "@/lib/types";
import { forgetHostKey, storeHostKey, useHostedCodes } from "../host/_lib/client-hooks";

const MAX_NAME = 60;

const STATUS: Record<SessionStatus, { icon: string; label: string }> = {
  lobby: { icon: "⏳", label: "Lobby" },
  playing: { icon: "▶", label: "Playing" },
  ended: { icon: "🏁", label: "Ended" },
};

/** Admin: session name + Create, plus the sessions this browser controls. */
export function AdminCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      <h1 className="sr-only">Admin</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
          maxLength={MAX_NAME}
          placeholder="Session name"
          aria-label="Session name"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-md border-2 border-line bg-surface-2 px-3 py-2 text-base text-text placeholder:text-muted/70 focus-visible:border-ember"
        />
        <Button type="submit" size="lg" disabled={busy} aria-busy={busy || undefined}>
          {busy ? (
            <span role="img" aria-label="Creating" className="inline-block size-4 animate-spin rounded-full border-2 border-bg border-t-transparent" />
          ) : (
            <>
              <span aria-hidden="true">▶</span> Create
            </>
          )}
        </Button>
      </form>
      {error && (
        <p id={errorId} role="alert" title={error} className="text-sm text-bad">
          <span aria-hidden="true">✗</span>
          <span className="sr-only">{error}</span>
        </p>
      )}

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
    <section aria-label="Your sessions">
      <ul className="flex flex-col gap-2">
        {ordered.map((code) => {
          const row = byCode.get(code);
          const status = row ? (STATUS[row.status] ?? STATUS.lobby) : null;
          return (
            <li
              key={code}
              className="flex items-center gap-2 rounded-lg border-2 border-line bg-surface px-3 py-1"
            >
              <Link
                href={`/host/${code}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded hover:text-ember-2"
              >
                <span className="font-pixel text-xs text-gold">{code}</span>
                <span className="truncate text-sm text-text">{row?.name ?? ""}</span>
              </Link>
              {status && (
                <span role="img" aria-label={status.label} title={status.label} className="text-base">
                  {status.icon}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Forget ${code}?`)) forgetHostKey(code);
                }}
                aria-label={`Forget ${code} on this device`}
                title="Forget"
                className="grid size-11 place-items-center rounded text-muted hover:text-bad"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
