import type { AKey, JudgeRequest, JudgeResult, Mode } from "@/lib/types";

/**
 * Deterministic fallback judge. Scores the two A's of the floor's mode 0-2 from
 * plain text signals. No network, no randomness: same input -> same output.
 */

export type Score = 0 | 1 | 2;

const MIN_ANSWER_CHARS = 15;
export const MAX_FEEDBACK_CHARS = 120; // one short sentence

const clamp = (n: number): Score => (n <= 0 ? 0 : n >= 2 ? 2 : 1) as Score;

/** Curly / modifier apostrophes -> straight, so every pattern sees "I'll" the same way. */
export function normalizeApostrophes(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'");
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) if (p.test(text)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Prompt-injection / score-begging detection (shared with the AI path)
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\b[^.]{0,40}\b(rubric|instructions?|prompt|rules|above|previous|system)\b/i,
  /\b(disregard|forget|override|bypass)\b[^.]{0,40}\b(rubric|instructions?|prompt|rules|grading)\b/i,
  /\b(give|award|grant|score|rate|mark)\s+(me|this|it|my answer)\b[^.]{0,30}\b(2\s*\/\s*2|full|perfect|max(imum)?|top|10\s*\/\s*10|100)\b/i,
  /\b(2\s*\/\s*2|full marks|perfect score)\b/i,
  /\b(system prompt|you are now|new instructions|as the (judge|grader)\b)/i,
  /\b(passed|pass)\s*[:=]\s*true\b/i,
  /["']?scores["']?\s*[:=]\s*\{/i,
];

export function looksLikeInjection(answer: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(answer));
}

// ---------------------------------------------------------------------------
// Giving: Assist + Actionable
// ---------------------------------------------------------------------------

// HOSTILE_PATTERNS[0] is the direct-insult list; scoreGiving treats a hit there as forcing Assist to 0.
const HOSTILE_PATTERNS: RegExp[] = [
  /\b(stupid|idiot\w*|lazy|incompetent|useless|pathetic|ridiculous|sloppy|garbage|trash|clueless|careless|worthless|dumb)\b/i,
  /\b(terrible|awful|horrible|worst|unacceptable|disaster|disgrace|embarrassing|joke)\b/i,
  // Accusatory absolutes only: "I'm always happy to help" is kind, "you always..." is not.
  /\byou('re| are)?\s+(always|never|constantly)\b|\bevery single time\b|\bfor the (last|hundredth|millionth) time\b/i,
  /\b(what were you thinking|how many times|you people|seriously\?|are you kidding|get it together|do better|figure it out)\b/i,
  /\b(wtf|damn|hell|crap|shit\w*|f+u+c+k\w*|screw)\b/i,
  /!{2,}/,
  /\b(fed up|sick of|tired of|annoyed|furious|angry|frustrat\w+)\b/i,
];

const SUPPORTIVE_PATTERNS: RegExp[] = [
  /\b(thanks|thank you|appreciate|grateful)\b/i,
  /\b(great|good|nice|solid|strong|well done|impressive|valuable|helpful|spot on|airtight|nailed)\b/i,
  /\b(i('ve| have)? noticed|i saw|i observed)\b/i,
  /\b(help|support|happy to|glad to|here to)\b/i,
  /\b(together|we can|let's|let us|team)\b/i,
  // Offers of support. No bare "want to": "I don't want to see this again" is not supportive.
  /\b(i'd love|would it help|want to (rehearse|practice|go over|walk through|try|pair|sit down))\b/i,
  /\b(i know|i understand|i get that|i realize|i recognize)\b/i,
  /\b(improve|grow|stronger|even better|build on|develop)\b/i,
  /\b(would you be open|how can i|what do you think|does that work|how does that sound)\b/i,
  /\b(because|so that|impact|which means|helps? (the|us|you))\b/i,
];

const ACTION_PATTERNS: RegExp[] = [
  /\b(next time|going forward|from now on|moving forward|in the future)\b/i,
  /\b(try|could you|can you|would you|please|i'd suggest|i suggest|i recommend|suggest|recommend|consider)\b/i,
  /\b(start|stop|make sure|include|add|send|check|double-check|schedule|set up|book|share|update|review|use|write|attach|flag|loop in|cc|confirm|reply|prepare|walk me through|break (it|this) (down|into)|summari[sz]e|lead with|open with|keep (it|them|each)|cut|trim|move|rehearse|practi[cs]e|aim for|limit|cap|swap|replace|walk through)\b/i,
  /\b(first|then|after that|step|steps|checklist|template|plan|agenda)\b/i,
  /\b(let's|let us|we could|you could|aim to|try to)\b/i,
];

const SPECIFIC_PATTERNS: RegExp[] = [
  /\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|this week|next week|end of (day|week|month)|eod|eow)\b/i,
  /\b\d+(\.\d+)?\s?(%|percent|minutes?|mins?|hours?|days?|weeks?|invoices?|items?|slides?|pages?|times?)\b/i,
  /\bby (noon|the|end|\d)/i,
  /(^|\n)\s*(\d+[.)]|[-*•])\s+\S/,
  /\b(deadline|due date|before the|after the|during the|in the (meeting|standup|report|email|deck|spreadsheet))\b/i,
];

function shoutingScore(answer: string): number {
  const capsWords = answer.match(/\b[A-Z]{3,}\b/g) ?? [];
  const acronyms = capsWords.filter((w) => w.length <= 4).length; // allow e.g. "EOD", "KPI"
  const loud = capsWords.length - acronyms + (acronyms >= 3 ? acronyms : 0);
  const letters = answer.replace(/[^a-z]/gi, "");
  const upper = answer.replace(/[^A-Z]/g, "");
  const ratio = letters.length ? upper.length / letters.length : 0;
  return loud >= 2 || ratio > 0.5 ? 1 : 0;
}

export function scoreGiving(rawAnswer: string): { assist: Score; actionable: Score } {
  const answer = normalizeApostrophes(rawAnswer);
  // A direct insult ("lazy", "sloppy") zeroes Assist no matter how many kind keywords surround it.
  const insult = HOSTILE_PATTERNS[0].test(answer);
  const hostile = countMatches(answer, HOSTILE_PATTERNS) + shoutingScore(answer) + (insult ? 2 : 0);
  const supportive = countMatches(answer, SUPPORTIVE_PATTERNS);
  const actions = countMatches(answer, ACTION_PATTERNS);
  const specifics = countMatches(answer, SPECIFIC_PATTERNS);

  const assistBase = supportive >= 2 ? 2 : 1;
  const penalty = hostile >= 2 ? 2 : hostile;
  const assist = clamp(assistBase - penalty);

  let actionable: Score;
  // Generic verbs alone ("try to plan and review") cap at 1; full marks need a what/when/number too.
  if (actions >= 2 && specifics >= 1) actionable = 2;
  else if (actions >= 1 || specifics >= 1) actionable = 1;
  else actionable = 0;
  // Very short answers rarely carry a concrete, doable step.
  if (actionable === 2 && answer.length < 40) actionable = 1;

  return { assist, actionable };
}

// ---------------------------------------------------------------------------
// Receiving: Appreciate + Accept or Decline
// ---------------------------------------------------------------------------

const THANKS_PATTERNS: RegExp[] = [
  /\b(thank you|thanks|thank u|thx|ty)\b/i,
  /\b(appreciate|grateful|means a lot)\b/i,
];

const THANKS_SPECIFIC: RegExp[] = [
  /\b(thank you|thanks|appreciate|grateful)\b[^.!?]{0,40}\b(for|taking the time|pointing|flagging|raising|feedback|input|honesty|being (honest|direct|candid)|telling me|letting me know|noticing|catching)\b/i,
  /\b(really|genuinely|truly|sincerely) (appreciate|thank|grateful)\b/i,
  /\bi appreciate (you|that|it|this|the)\b/i,
];

const SARCASM_PATTERNS: RegExp[] = [
  /\bthanks? (for nothing|a lot\b[^.]*\bnot)\b/i,
  /\b(thanks|thank you),? i guess\b/i,
  /\bgee,? thanks\b/i,
  /\bthanks for the (lecture|criticism)\b/i,
];

const DEFENSIVE_PATTERNS: RegExp[] = [
  /\b(whatever|who cares|not my (fault|problem|job)|you'?re wrong|that'?s not fair|that'?s unfair|ugh|seriously\?|you don'?t understand|you have no idea)\b/i,
  /\b(how dare|mind your own|back off|leave me alone|i don'?t need (your|this|feedback))\b/i,
  /\b(but you|well you|you also|you never|you always)\b/i,
  /!{2,}/,
];

const WEIGH_PATTERNS: RegExp[] = [
  /\b(makes sense|good point|fair point|that'?s fair|you'?re right|i see (your|what|that|the)|i hear you|i understand|i get (it|that|your)|i agree|i disagree|i partly agree|on reflection|thinking about it|having thought|i thought about|i'?ve thought|considered|weigh|weighed|valid|i can see|i think|i believe|in my view|my concern is|the reason (is|being)|which is why|for that reason)\b/i,
  // "X, so I'll Y" is reasoning; a bare "so" is not ("thank you so much").
  /\b(because|since|so that|given that|that said|however|although|while|but i think|on the other hand)\b|,\s*so\b|\bso (i'?ll|i will|we'?ll|we will|i'?m|let'?s)\b/i,
];

const DECISION_PATTERNS: RegExp[] = [
  /\b(i'?ll|i will|i'?m going to|i am going to|going to|i plan to|i intend to|i'?ve decided|i have decided|i decided|i'?m choosing|i choose)\b/i,
  /\b(i'?m not going to|i won'?t|i will not|i'?ll keep|i'?m keeping|i'?ll stick|i'?ll start|i'?ll try|from now on|next time i|starting (today|tomorrow|monday|next))\b/i,
  // Speaking for the team / firm, or recommending a course: still a decision.
  /\b(we'?ll|we will|we'?re going to|we are going to|we won'?t|we will not|we'?re keeping|we plan to|let'?s (keep|stick|try|start|fix|move|set)|i'?d (recommend|suggest|prefer|rather|keep|like to keep)|my (recommendation|plan) is)\b/i,
];

const BLIND_PATTERNS: RegExp[] = [
  /\b(whatever you (say|want)|you'?re the boss|i'?ll do (whatever|anything|everything) you)\b/i,
  /\b(i'?ll change everything|i'?ll do it all|anything you say)\b/i,
];

const DISMISS_PATTERNS: RegExp[] = [
  /\b(not changing|i'?m fine (as|the way)|no need|i don'?t need to change|doesn'?t apply|not doing that|nope)\b/i,
];

// Contempt for the feedback itself: a stock thank-you plus "because" must not read as a reasoned decline.
const CONTEMPT_PATTERNS: RegExp[] = [
  /\b(don'?t care|do not care|couldn'?t care less|i know best|i know better|ignore (it|this|that|you|your|the feedback)|(doing|do|keep|keeping) (it|things) my (own )?way|not listening|waste of (my )?time)\b/i,
];

export function scoreReceiving(rawAnswer: string): { appreciate: Score; acceptOrDecline: Score } {
  const answer = normalizeApostrophes(rawAnswer);
  const sarcastic = countMatches(answer, SARCASM_PATTERNS) > 0;
  const contempt = countMatches(answer, CONTEMPT_PATTERNS) > 0;
  const defensive = countMatches(answer, DEFENSIVE_PATTERNS) + shoutingScore(answer) + (contempt ? 2 : 0);

  const weighs = countMatches(answer, WEIGH_PATTERNS);
  const decides = countMatches(answer, DECISION_PATTERNS) > 0;
  const blind = countMatches(answer, BLIND_PATTERNS) > 0;
  const dismiss = countMatches(answer, DISMISS_PATTERNS) > 0;

  let appreciate: number = 0;
  if (!sarcastic && countMatches(answer, THANKS_PATTERNS) > 0) {
    appreciate = countMatches(answer, THANKS_SPECIFIC) > 0 ? 2 : 1;
  }
  // A plain "Thank you." followed by a reasoned decision is full, sincere appreciation.
  if (appreciate === 1 && decides && weighs >= 1) appreciate = 2;
  if (defensive >= 2) appreciate = 0;
  else if (defensive === 1) appreciate -= 1;

  let accept: number;
  if (decides && weighs >= 1) accept = 2;
  else if (decides || weighs >= 1) accept = 1;
  else accept = 0;
  if (blind) accept = Math.min(accept, 1);
  if (dismiss && weighs === 0) accept = 0;
  if (defensive >= 2) accept = Math.min(accept, 1);
  if (contempt) accept = 0;

  return { appreciate: clamp(appreciate), acceptOrDecline: clamp(accept) };
}

// ---------------------------------------------------------------------------
// Feedback text (models Assist + Actionable itself)
// ---------------------------------------------------------------------------

// Every feedback string is ONE sentence of at most MAX_FEEDBACK_CHARS: a single next step for the weakest A.

const BOTH_GREAT: Record<Mode, string> = {
  giving: "Helpful tone and a clear next step: that's both A's.",
  receiving: "Sincere thanks and a reasoned choice: that's both A's.",
};

const TIPS: Record<AKey, string> = {
  assist: "Drop the blame and say what you saw, like \"The totals were off, which delayed close.\"",
  actionable: "Add one concrete step with a when, like \"Could you run the checklist by 3pm?\"",
  appreciate: "Start with a specific thank-you, like \"Thanks for flagging the invoice errors.\"",
  acceptOrDecline: "Say what you'll do and why, like \"I'll add checks, but keep my format for finance.\"",
};

const MILD_TIPS: Record<AKey, string> = {
  assist: "Name one thing they did well first, so it lands as help.",
  actionable: "Make your step more specific with a time, number, or example.",
  appreciate: "Make your thank-you specific to what they pointed out.",
  acceptOrDecline: "Add a short reason for your choice, so it reads as a decision.",
};

const INJECTION_TIP = "Only what you'd really say to your coworker gets graded, so write that.";
const TOO_SHORT_TIP = "Too short to judge, so write 2-3 sentences you'd really say.";

/** End of the first sentence (ignores "e.g." / "i.e."), or -1 when there is only one sentence. */
function firstSentenceEnd(text: string): number {
  const re = /[.!?]["”']?(?=\s+\S)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 3), m.index + 1).toLowerCase();
    if (/(e\.g\.|i\.e\.|vs\.)$/.test(before)) continue;
    return m.index + m[0].length;
  }
  return -1;
}

/** Keep only the first sentence, capped at MAX_FEEDBACK_CHARS at a word boundary, closing any open quote. */
export function fit(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  const end = firstSentenceEnd(out);
  if (end > 0) out = out.slice(0, end).trim();
  if (out.length > MAX_FEEDBACK_CHARS) {
    const cut = out.slice(0, MAX_FEEDBACK_CHARS - 2);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:]+$/, "")}…`;
  }
  if ((out.match(/"/g) ?? []).length % 2 === 1) out += '"';
  else if ((out.match(/“/g) ?? []).length > (out.match(/”/g) ?? []).length) out += "”";
  return out;
}

export function buildFeedback(mode: Mode, scores: Record<AKey, Score> | Partial<Record<AKey, Score>>, injection = false): string {
  const [a1, a2] = mode === "giving" ? (["assist", "actionable"] as const) : (["appreciate", "acceptOrDecline"] as const);
  const s1 = scores[a1] ?? 0;
  const s2 = scores[a2] ?? 0;

  if (injection) return fit(INJECTION_TIP);
  if (s1 === 2 && s2 === 2) return fit(BOTH_GREAT[mode]);
  if (s1 === 0 && s2 === 0) return fit(TIPS[a1]);

  // Coach the weaker A (ties go to the first A).
  const weak = s1 <= s2 ? a1 : a2;
  const weakScore = scores[weak] ?? 0;
  return fit(weakScore === 0 ? TIPS[weak] : MILD_TIPS[weak]);
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function isPassing(mode: Mode, scores: Partial<Record<AKey, Score>>): boolean {
  const [a1, a2] = mode === "giving" ? ["assist", "actionable"] as const : ["appreciate", "acceptOrDecline"] as const;
  const s1 = scores[a1] ?? 0;
  const s2 = scores[a2] ?? 0;
  return s1 >= 1 && s2 >= 1 && s1 + s2 >= 3;
}

export function heuristicJudge(req: Pick<JudgeRequest, "mode" | "answer">): JudgeResult {
  const answer = normalizeApostrophes((req.answer ?? "").trim());
  const injection = looksLikeInjection(answer);

  let scores: Partial<Record<AKey, Score>>;
  if (answer.length < MIN_ANSWER_CHARS || injection) {
    scores = req.mode === "giving" ? { assist: 0, actionable: 0 } : { appreciate: 0, acceptOrDecline: 0 };
  } else {
    scores = req.mode === "giving" ? scoreGiving(answer) : scoreReceiving(answer);
  }

  return {
    scores,
    passed: isPassing(req.mode, scores),
    feedback: answer.length < MIN_ANSWER_CHARS && !injection
      ? fit(TOO_SHORT_TIP)
      : buildFeedback(req.mode, scores, injection),
    source: "heuristic",
  };
}
