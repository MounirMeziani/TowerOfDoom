// Examples for the /learn reference card: one bad and one good example per A, plus why.
// Keep each field short: bad/good <= 90 chars, why <= 90 chars.
import type { AKey } from "@/lib/types";

export const LEARN_EXAMPLES: Record<AKey, { bad: string; good: string; why: string }> = {
  assist: {
    bad: "“You missed the deadline again. I'm so done with this.”",
    good: "“I want to help you hit the next deadline. Would a reminder three days out help?”",
    why: "Feedback should come from wanting them to improve, not from venting.",
  },
  actionable: {
    bad: "“Your reconciliations need to be better.”",
    good: "“Add a note for each difference and tie out the totals before you submit.”",
    why: "Give a clear step they can actually do.",
  },
  appreciate: {
    bad: "“Well, that's not how I see it.”",
    good: "“Thank you for telling me. I know that wasn't easy to bring up.”",
    why: "Say thank you, even when it stings or you disagree.",
  },
  acceptOrDecline: {
    bad: "“Sure, I'll change everything you said.”",
    good: "“I'll send agendas a day ahead, but keep the weekly check-in. The team relies on it.”",
    why: "Weigh it, then choose. Declining with a reason is allowed.",
  },
};
