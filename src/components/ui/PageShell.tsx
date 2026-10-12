import Link from "next/link";
import type { ReactNode } from "react";

export interface PageShellProps {
  children: ReactNode;
  /** Wide layout for host / projector pages. */
  wide?: boolean;
}

const NAV = [
  { href: "/play", label: "Play" },
  { href: "/learn", label: "Learn" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/admin", label: "Admin" },
] as const;

export function PageShell({ children, wide = false }: PageShellProps) {
  const width = wide ? "max-w-[1800px]" : "max-w-3xl";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-line bg-bg/85 backdrop-blur print:hidden">
        <div className={`mx-auto flex w-full ${width} flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2`}>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 font-pixel text-[0.625rem] leading-tight text-ember sm:text-xs"
          >
            <span aria-hidden="true" className="text-base sm:text-xs">🗼</span>
            <span className="sr-only sm:not-sr-only">OLSEN TOWER OF DOOM</span>
          </Link>
          <nav aria-label="Main">
            <ul className="-mx-2 flex items-center">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded px-2 text-sm font-medium text-muted transition-colors hover:text-text"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className={`mx-auto flex w-full ${width} flex-1 flex-col px-4 py-6 sm:py-8`}>
        {children}
      </main>
    </div>
  );
}
