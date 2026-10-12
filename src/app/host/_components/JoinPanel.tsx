"use client";

import { QRCodeSVG } from "qrcode.react";
import { Panel } from "@/components/ui/Panel";
import { useOrigin } from "../_lib/client-hooks";

/** Join code + QR code for <origin>/?s=CODE. `large` for the lobby, compact during play. */
export function JoinPanel({ code, sessionName, large = false }: { code: string; sessionName: string; large?: boolean }) {
  const origin = useOrigin();
  const joinUrl = origin ? `${origin}/?s=${code}` : "";
  const displayUrl = joinUrl.replace(/^https?:\/\//, "");
  // Split "host/?s=CODE" so the URL only breaks after a "." in the host, never inside "/?s=CODE".
  const slash = displayUrl.indexOf("/");
  const host = slash >= 0 ? displayUrl.slice(0, slash) : displayUrl;
  const path = slash >= 0 ? displayUrl.slice(slash) : "";
  const hostSegments = host.split(".").map((part, i, all) => (
    <span key={i}>
      {part}
      {i < all.length - 1 && (
        <>
          .<wbr />
        </>
      )}
    </span>
  ));

  return (
    <Panel as="section" aria-label="How to join" className="flex flex-col items-center gap-4 text-center">
      <p className={`font-pixel uppercase text-muted ${large ? "text-xs xl:text-sm" : "text-[0.625rem]"}`}>
        {large ? "Join the climb" : "Late? Still welcome"}
      </p>
      <p className="max-w-full truncate text-sm text-muted xl:text-base" title={sessionName}>
        {sessionName}
      </p>
      <div className="flex flex-col items-center gap-1">
        <span className="font-pixel text-[0.625rem] uppercase text-muted">Code</span>
        <span
          className={`font-pixel leading-none tracking-[0.12em] text-gold drop-shadow-[0_0_24px_rgb(255_207_74/0.35)] ${
            large ? "text-[clamp(2.25rem,7vw,6.5rem)]" : "text-2xl xl:text-3xl"
          }`}
          aria-label={`Session code ${code.split("").join(" ")}`}
        >
          {code}
        </span>
      </div>
      <div
        className={`rounded-lg border-4 border-ember bg-white p-3 shadow-[0_0_40px_-10px_var(--ember)] ${
          large ? "w-[min(22rem,70vw)]" : "w-40 xl:w-48"
        }`}
      >
        {joinUrl ? (
          <QRCodeSVG
            value={joinUrl}
            size={512}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#0b0614"
            title={`QR code to join session ${code}`}
            className="block h-auto w-full"
          />
        ) : (
          <div className="aspect-square w-full animate-pulse bg-[#eee]" aria-hidden="true" />
        )}
      </div>
      <p className={`max-w-full text-text [overflow-wrap:anywhere] ${large ? "text-base xl:text-xl" : "text-xs xl:text-sm"}`}>
        {displayUrl ? (
          <>
            Scan or visit{" "}
            {large ? (
              <span className="font-semibold text-ember-2">
                {hostSegments}
                <wbr />
                <span className="whitespace-nowrap">{path}</span>
              </span>
            ) : (
              <span className="block font-semibold text-ember-2">
                <span className="block">{hostSegments}</span>
                <span className="block whitespace-nowrap">{path}</span>
              </span>
            )}
          </>
        ) : (
          " "
        )}
      </p>
    </Panel>
  );
}
