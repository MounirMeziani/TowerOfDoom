import Link from "next/link";
import { A_INFO, MODE_AS, type Mode } from "@/lib/types";

const CHIP: Record<Mode, string> = {
  giving: "border-giving/40 bg-giving/10 text-giving hover:border-giving",
  receiving: "border-receiving/40 bg-receiving/10 text-receiving hover:border-receiving",
};

/** The 4 A names as small chips, each linking to /learn#<aKey>. */
export function TwoAsGrid() {
  return (
    <nav aria-label="The 2 A's of Feedback">
      <ul className="flex flex-wrap justify-center gap-2">
        {(["giving", "receiving"] as const).flatMap((mode) =>
          MODE_AS[mode].map((a) => (
            <li key={a}>
              <Link
                href={`/learn#${a}`}
                title={A_INFO[a].short}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold transition-colors ${CHIP[mode]}`}
              >
                <span aria-hidden="true">{mode === "giving" ? "🗣" : "👂"}</span>
                {A_INFO[a].label}
              </Link>
            </li>
          )),
        )}
      </ul>
    </nav>
  );
}
