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
    <Panel
      as="section"
      aria-label={`Join ${sessionName}`}
      className={`@container flex flex-col items-center gap-4 text-center ${large ? "justify-center" : ""}`.trim()}
    >
      <div className="flex flex-col items-center gap-1">
        <span
          className={`font-pixel leading-none tracking-[0.12em] text-gold drop-shadow-[0_0_24px_rgb(255_207_74/0.35)] ${
            large ? "" : "text-2xl xl:text-3xl"
          }`}
          style={large ? { fontSize: `min(6.5rem, ${(86 / (code.length * 1.14)).toFixed(1)}cqi)` } : undefined}
          aria-label={`Session code ${code.split("").join(" ")}`}
        >
          {code}
        </span>
      </div>
      {/* Large: grow to the column width, capped so code + QR + URL fit the stage height.
          min(70vh,52rem) must match STAGE_LOBBY in HostSessionView.tsx; 15rem = code, URL, gaps, padding. */}
      <div
        className={`rounded-lg border-4 border-ember bg-white p-3 shadow-[0_0_40px_-10px_var(--ember)] ${
          large ? "w-[min(100%,30rem,calc(min(70vh,52rem)-15rem))]" : "w-40 xl:w-48"
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
