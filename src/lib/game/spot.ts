// Spot floors: which of the mode's two A's the quoted feedback/reaction actually contains.
// On spot floors a choice's hits/misses mean "did this verdict judge the A correctly", NOT "the quote
// has this A", so the reveal needs the quote's real status to teach the right lesson.
import { MODE_AS, type AKey, type Choice, type RegularFloor } from "@/lib/types";

type ChoiceWithPresence = Choice & { present?: AKey[] };

// Content convention (src/content/floors.ts spotChoices): ids a-d are the verdicts, in this order.
// [first A present, second A present]
const PRESENCE_BY_ID: Record<string, readonly [boolean, boolean]> = {
  a: [false, true], // missed the first A
  b: [true, false], // missed the second A
  c: [false, false], // missed both
  d: [true, true], // nailed both
};

/** The A's the quote contains, or null when it can't be determined. */
export function spotQuotePresence(floor: RegularFloor): AKey[] | null {
  if (floor.kind !== "spot") return null;
  const correct = floor.choices.find((c) => c.correct) as ChoiceWithPresence | undefined;
  if (!correct) return null;
  const keys = MODE_AS[floor.mode];
  if (Array.isArray(correct.present)) return keys.filter((k) => correct.present?.includes(k));
  const presence = PRESENCE_BY_ID[correct.id];
  if (!presence) return null;
  return keys.filter((_, i) => presence[i]);
}
