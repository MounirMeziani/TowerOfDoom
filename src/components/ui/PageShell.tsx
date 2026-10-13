import Link from "next/link";
import type { ReactNode } from "react";

export interface PageShellProps {
  children: ReactNode;
  /** Wide layout for host / projector pages. */
  wide?: boolean;
}

const NAV = [
  { href: "/play", icon: "▶", label: "Play" },
  { href: "/learn", icon: "📖", label: "Learn the 2 A's" },
  { href: "/leaderboard", icon: "🏆", label: "Leaderboard" },
  { href: "/admin", icon: "⚙", label: "Admin" },
] as const;

export function PageShell({ children, wide = false }: PageShellProps) {
  const width = wide ? "max-w-[1800px]" : "max-w-3xl";
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="sticky top-0 z-30 border-b-2 border-line bg-bg/85 backdrop-blur print:hidden">
        <div className={`mx-auto flex w-full ${width} items-center justify-between gap-4 px-4 py-1`}>
          <Link
            href="/"
            aria-label="Olsen Tower of Doom, home"
            title="Home"
            className="grid size-11 place-items-center rounded text-xl hover:bg-surface-2"
          >
            <span aria-hidden="true">🗼</span>
          </Link>
          <nav aria-label="Main">
            <ul className="-mr-2 flex items-center">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    title={item.label}
                    className="grid size-11 place-items-center rounded text-lg text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <span aria-hidden="true">{item.icon}</span>
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
