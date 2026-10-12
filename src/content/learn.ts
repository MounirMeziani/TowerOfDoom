// Examples for the /learn reference card: one bad and one good example per A, plus why.
import type { AKey } from "@/lib/types";

export const LEARN_EXAMPLES: Record<AKey, { bad: string; good: string; why: string }> = {
  assist: {
    bad: "“I can't believe you missed the invoice deadline again. I'm so done with this.”",
    good: "“I want to help you hit the next deadline. What got in the way, and would a reminder three days out help?”",
    why: "Assist means your feedback comes from wanting the person to improve, not from venting frustration or anger.",
  },
  actionable: {
    bad: "“Your reconciliations need to be better.”",
    good: "“Could you add a one-line note for each reconciling item and tie out the totals before you submit?”",
    why: "Actionable feedback names clear, concrete steps the person can actually do. If they can't act on it, it isn't feedback yet.",
  },
  appreciate: {
    bad: "“Well, that's not how I see it.” (followed by an immediate defence)",
    good: "“Thank you for telling me. I know that wasn't easy to bring up.”",
    why: "Appreciate means saying thank you for the input, even when it feels uncomfortable or you disagree.",
  },
  acceptOrDecline: {
    bad: "“Sure, I'll change everything you said.” (agreeing without thinking it through)",
    good: "“I've thought about it. I'll send agendas a day ahead, but I'll keep the weekly check-in because the team relies on it.”",
    why: "Weigh the guidance, then choose. Accepting part and declining part, with your reasons, is fully allowed. Blind yeses and reflex noes both miss.",
  },
};
