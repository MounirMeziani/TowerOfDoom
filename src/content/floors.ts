// Floor content for Olsen Tower of Doom.
// 24 regular floors (12 giving, 12 receiving), all kind "choose", plus 4 boss floors.
// Giving feedback  -> Assist + Actionable.   Receiving feedback -> Appreciate + Accept or Decline.
//
// Clarity rules (the question panel shows only: mode icon, setup, prompt, 3 choices):
// - setup: 1-2 plain sentences, second person, <= 140 chars
// - prompt: one short question, <= 50 chars
// - exactly 3 choices, <= 90 chars each: one correct (hits both A's), and two wrong ones that each
//   clearly fail a DIFFERENT A of the mode (missFirst fails the mode's first A, missSecond the second)
// - every explanation: one sentence, <= 110 chars, naming the A
// Villain + department are silent 3D flavor only (never shown in the question/reveal UI).
import { MODE_AS, type BossFloor, type Choice, type Mode, type RegularFloor, type Villain } from "@/lib/types";

/** [choice text, one-sentence explanation] */
type Option = readonly [text: string, explanation: string];

interface FloorSpec {
  id: string;
  mode: Mode;
  department: string;
  villain: Villain;
  setup: string;
  prompt: string;
  best: Option;        // correct: hits both of the mode's A's
  missFirst: Option;   // fails the mode's first A (Assist / Appreciate), gets the second right
  missSecond: Option;  // fails the mode's second A (Actionable / Accept or Decline), gets the first right
}

/** Stable per-floor position for the correct answer, so source order never gives it away. */
function slotFor(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 3;
}

function floor(spec: FloorSpec): RegularFloor {
  const [first, second] = MODE_AS[spec.mode];
  const best: Omit<Choice, "id"> = {
    text: spec.best[0],
    explanation: spec.best[1],
    correct: true,
    hits: [first, second],
    misses: [],
  };
  const wrongFirst: Omit<Choice, "id"> = {
    text: spec.missFirst[0],
    explanation: spec.missFirst[1],
    correct: false,
    hits: [second],
    misses: [first],
  };
  const wrongSecond: Omit<Choice, "id"> = {
    text: spec.missSecond[0],
    explanation: spec.missSecond[1],
    correct: false,
    hits: [first],
    misses: [second],
  };
  const ordered = [wrongFirst, wrongSecond];
  ordered.splice(slotFor(spec.id), 0, best);
  return {
    id: spec.id,
    kind: "choose",
    mode: spec.mode,
    department: spec.department,
    villain: spec.villain,
    setup: spec.setup,
    prompt: spec.prompt,
    choices: ordered.map((c, i) => ({ ...c, id: String.fromCharCode(97 + i) })), // a, b, c
  };
}

// ---------------------------------------------------------------------------------------------
// GIVING FEEDBACK (12) — Assist + Actionable
// ---------------------------------------------------------------------------------------------
const GIVING: RegularFloor[] = [
  floor({
    id: "g-ap-01",
    mode: "giving",
    department: "Accounts Payable",
    villain: { name: "Sir Rants-a-Lot", emoji: "🗯️", title: "Knight of Reply-All", taunt: "Just vent!" },
    setup: "New teammate Jordan coded 12 invoices to the wrong accounts. You spent your morning fixing them.",
    prompt: "What do you say to Jordan?",
    best: [
      "Let's review the account cheat sheet together, and I'll check your next batch Thursday.",
      "It offers help (Assist) and gives clear steps with a day attached (Actionable).",
    ],
    missFirst: [
      "I wasted my whole morning on this. Use the cheat sheet on every invoice.",
      "The step is clear, but complaining about your morning is venting, not helping (misses Assist).",
    ],
    missSecond: [
      "No worries, coding is tricky! Just try to be more careful next time.",
      "Kind, but “be more careful” is not a step Jordan can act on (misses Actionable).",
    ],
  }),
  floor({
    id: "g-cs-02",
    mode: "giving",
    department: "Client Success",
    villain: { name: "The Monologue Monster", emoji: "👾", title: "Devourer of Time", taunt: "Say it was long. Done." },
    setup: "Aisha's client demo ran 25 minutes over, and the CFO left before the pricing slide. She asks how it went.",
    prompt: "What do you tell Aisha?",
    best: [
      "Your walkthrough was clear. Next time, cap it at 30 minutes and show pricing by minute 20.",
      "It builds on what worked (Assist) and gives a time cap and slide order she can use (Actionable).",
    ],
    missFirst: [
      "We lost the CFO because you dragged on. Cap it at 30 minutes next time.",
      "The time cap is clear, but blaming her is frustration, not help (misses Assist).",
    ],
    missSecond: [
      "It was great overall! Maybe a bit long? Something to think about.",
      "Friendly, but “a bit long” leaves her guessing what to change (misses Actionable).",
    ],
  }),
  floor({
    id: "g-close-03",
    mode: "giving",
    department: "Month-End Close",
    villain: { name: "Baron Blame", emoji: "🫵", title: "Pointer of Fingers", taunt: "Find the culprit!" },
    setup: "Ravi's bank reconciliation is off by $4,312, with no notes on the differences. Close is in two days.",
    prompt: "What do you tell Ravi?",
    best: [
      "Let's find the gap together. Add a note for each difference and tie it out by Wednesday.",
      "It offers to help (Assist) and names exact steps with a deadline (Actionable).",
    ],
    missFirst: [
      "This rec is a mess. Add notes and fix the variance today.",
      "The tasks are clear, but calling it a mess is not aimed at helping Ravi (misses Assist).",
    ],
    missSecond: [
      "Thanks for starting this! I'm sure you'll sort it out, you always do.",
      "Warm, but it never says what to fix (misses Actionable).",
    ],
  }),
  floor({
    id: "g-it-04",
    mode: "giving",
    department: "IT Help Desk",
    villain: { name: "The Ghost Reviewer", emoji: "👻", title: "Haunter of Silence", taunt: "Say nothing. Ever." },
    setup: "Mei from the help desk closed your VPN ticket with no notes. The VPN still drops every hour.",
    prompt: "What do you tell Mei?",
    best: [
      "Thanks for the quick help! It still drops hourly. Can you reopen it and log your steps?",
      "It's respectful and helpful (Assist) and asks for two clear actions (Actionable).",
    ],
    missFirst: [
      "Closing it with no notes was lazy. Reopen it now and write down what you did.",
      "The steps are clear, but calling her lazy is an insult, not help (misses Assist).",
    ],
    missSecond: [
      "Thanks so much, you're always great! It's still a bit flaky, but no stress.",
      "Kind, but she has no idea what to do next (misses Actionable).",
    ],
  }),
  floor({
    id: "g-sales-05",
    mode: "giving",
    department: "Sales",
    villain: { name: "Count Nitpick", emoji: "🧛", title: "Drainer of Morale", taunt: "Nitpick everything!" },
    setup: "Diego's pitch deck has 38 slides and buries the key number on slide 31. He asks for a review before tomorrow.",
    prompt: "What do you tell Diego?",
    best: [
      "Strong content! Move the key number to slide 2 and cut to 12 slides. Want to run it at 4?",
      "It starts with a real strength and offers practice (Assist) and gives exact changes (Actionable).",
    ],
    missFirst: [
      "Nobody will sit through 38 slides of this. Cut it to 12 and move the number up.",
      "The changes are clear, but the put-down makes it about your annoyance (misses Assist).",
    ],
    missSecond: [
      "Looks like a lot of work went into this! Maybe tighten it up a bit?",
      "Nice, but “tighten it up” doesn't say what to cut or move (misses Actionable).",
    ],
  }),
  floor({
    id: "g-data-06",
    mode: "giving",
    department: "Data & Reporting",
    villain: { name: "The Sarcasm Sphinx", emoji: "😼", title: "Asker of Riddles", taunt: "Be sarcastic!" },
    setup: "Lena's spreadsheet totals were typed in by hand, so they broke when new data came in. The client noticed first.",
    prompt: "What do you tell Lena?",
    best: [
      "Let's fix it together: swap the typed totals for SUM formulas and add a check row.",
      "It's supportive (Assist) and gives a specific fix she can do today (Actionable).",
    ],
    missFirst: [
      "Typed-in totals? Really? Use formulas, and don't embarrass us again.",
      "The fix is clear, but the sarcasm is venting, not help (misses Assist).",
    ],
    missSecond: [
      "Don't worry, spreadsheets are hard. Just double-check things next time.",
      "Kind, but “double-check things” is too vague to act on (misses Actionable).",
    ],
  }),
  floor({
    id: "g-pm-07",
    mode: "giving",
    department: "Project Management",
    villain: { name: "The Deadline Dragon", emoji: "🐲", title: "Scorcher of Meetings", taunt: "Burn them!" },
    setup: "Marcus missed a project milestone by a week and only told you on the due date. The client launch slipped.",
    prompt: "What do you tell Marcus?",
    best: [
      "I want to help you flag risks early. Send me a short status every Friday, risks first.",
      "It's aimed at his growth (Assist) and sets a clear weekly habit (Actionable).",
    ],
    missFirst: [
      "You sank the launch. Send me a status update every Friday from now on.",
      "The habit is clear, but “you sank the launch” is blame, not help (misses Assist).",
    ],
    missSecond: [
      "These things happen! Just keep me in the loop a bit more, okay?",
      "Supportive, but “a bit more” gives him nothing concrete to do (misses Actionable).",
    ],
  }),
  floor({
    id: "g-mkt-08",
    mode: "giving",
    department: "Marketing",
    villain: { name: "Lady Looks-Great", emoji: "🍵", title: "Duchess of Meh", taunt: "Looks great. Next!" },
    setup: "Sam's client newsletter is almost done, but the demo link is buried in paragraph six. Sam asks for a quick look.",
    prompt: "What do you tell Sam?",
    best: [
      "The stories are great. Move the demo link into the first paragraph as a button.",
      "It names a real strength (Assist) and one exact change (Actionable).",
    ],
    missFirst: [
      "Nobody will ever find that link. Move it to the first paragraph.",
      "The change is clear, but the jab is not meant to help Sam (misses Assist).",
    ],
    missSecond: [
      "Looks great! Maybe make the link pop a bit more?",
      "Friendly, but “make it pop” doesn't say what to do (misses Actionable).",
    ],
  }),
  floor({
    id: "g-train-09",
    mode: "giving",
    department: "Training",
    villain: { name: "The Snark Knight", emoji: "🗡️", title: "Backhanded Blade", taunt: "Snark wins!" },
    setup: "A teammate ran their first client training, and half the room was on their phones. They ask for your feedback.",
    prompt: "What do you say?",
    best: [
      "You know the portal well. Next time, try 10 slides and a hands-on exercise at minute 15.",
      "It starts with a real strength (Assist) and gives two concrete changes (Actionable).",
    ],
    missFirst: [
      "Honestly, it was a snooze-fest. Cut it to 10 slides and add an exercise.",
      "The steps are clear, but “snooze-fest” is an insult, not help (misses Assist).",
    ],
    missSecond: [
      "You did great for a first time! Maybe make it more engaging?",
      "Encouraging, but “more engaging” doesn't say how (misses Actionable).",
    ],
  }),
  floor({
    id: "g-onb-10",
    mode: "giving",
    department: "Onboarding",
    villain: { name: "The Vague-inator", emoji: "🌫️", title: "Lord of Fog", taunt: "Be vague!" },
    setup: "A new consultant ran their first client kickoff but never confirmed the timeline. The client left unsure.",
    prompt: "What do you tell them?",
    best: [
      "Great energy! Next time, confirm the timeline before you end and email it within an hour.",
      "It's encouraging (Assist) and gives two clear steps with timing (Actionable).",
    ],
    missFirst: [
      "That was rough to watch. Always confirm the timeline before the call ends.",
      "The step is clear, but “rough to watch” is a jab, not help (misses Assist).",
    ],
    missSecond: [
      "Great energy! Just be a bit more organized next time.",
      "Positive, but “more organized” is not a step they can take (misses Actionable).",
    ],
  }),
  floor({
    id: "g-legal-11",
    mode: "giving",
    department: "Legal & Contracts",
    villain: { name: "The Eye-Roll Oracle", emoji: "🔮", title: "Seer of Nothing", taunt: "Just sigh loudly." },
    setup: "A colleague reviewed a client contract but missed the payment-terms clause. You're checking their work.",
    prompt: "What do you tell them?",
    best: [
      "Good catches overall. Add payment terms to your checklist and review that clause first.",
      "It credits their work (Assist) and gives a specific habit to adopt (Actionable).",
    ],
    missFirst: [
      "You missed the one clause that matters. Check payment terms first, always.",
      "The habit is clear, but the dig is not meant to help them (misses Assist).",
    ],
    missSecond: [
      "Nice work! Just be a little more thorough next time.",
      "Kind, but “more thorough” doesn't say what to check (misses Actionable).",
    ],
  }),
  floor({
    id: "g-exec-12",
    mode: "giving",
    department: "Executive Suite",
    villain: { name: "The Doubt Demon", emoji: "😈", title: "Whisperer of Doubt", taunt: "Something's off..." },
    setup: "An analyst's board memo has excellent analysis, but the recommendation is hidden on page four.",
    prompt: "What do you tell them?",
    best: [
      "Great analysis. Put the recommendation in the first paragraph so the board sees it.",
      "It credits their work (Assist) and gives one clear change (Actionable).",
    ],
    missFirst: [
      "Did you even think about the board? Put the recommendation at the top.",
      "The change is clear, but the sarcastic question isn't help (misses Assist).",
    ],
    missSecond: [
      "Excellent analysis! Maybe just rethink the structure a little?",
      "Kind, but “rethink the structure” doesn't say what to move (misses Actionable).",
    ],
  }),
];

// ---------------------------------------------------------------------------------------------
// RECEIVING FEEDBACK (12) — Appreciate + Accept or Decline
// Floors where the best answer thanks them and (partly) declines: r-close-02, r-legal-04,
// r-exec-06, r-ap-10, r-pm-12.
// ---------------------------------------------------------------------------------------------
const RECEIVING: RegularFloor[] = [
  floor({
    id: "r-onb-01",
    mode: "receiving",
    department: "Onboarding",
    villain: { name: "The Excuse Engine", emoji: "⚙️", title: "Maker of Buts", taunt: "Yeah, but..." },
    setup: "Your manager says your 60-step client checklist is overwhelming. She suggests grouping it into five phases.",
    prompt: "How do you respond?",
    best: [
      "Thanks for telling me. Five phases makes sense, so I'll regroup it by Friday.",
      "You thank her (Appreciate) and make a clear, reasoned choice (Accept or Decline).",
    ],
    missFirst: [
      "Clients just need to read it properly. Fine, I'll split it into phases.",
      "You decide, but the defensive opener skips any thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks for the feedback! I'll keep it in mind.",
      "Nice thanks, but “I'll keep it in mind” is not a decision (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-close-02",
    mode: "receiving",
    department: "Month-End Close",
    villain: { name: "The Bobblehead Baron", emoji: "🪆", title: "Nodder at All", taunt: "Just nod!" },
    setup: "Your controller wants variance notes, a landscape layout, and renamed tabs. Renaming tabs would break your export.",
    prompt: "How do you respond?",
    best: [
      "Thanks! I'll add notes and go landscape, but I'll keep the tab names so the export works.",
      "You thank them (Appreciate) and accept two ideas while declining one with a reason (Accept or Decline).",
    ],
    missFirst: [
      "Why are you nitpicking my tabs? I'll do notes and landscape, not the tabs.",
      "Your choice is sound, but it's defensive with no thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks! I'll do all three right away.",
      "Renaming tabs breaks your export, so agreeing without weighing it misses Accept or Decline.",
    ],
  }),
  floor({
    id: "r-cs-03",
    mode: "receiving",
    department: "Client Success",
    villain: { name: "The Inbox Inferno", emoji: "🔥", title: "Blazer of CAPS", taunt: "REPLY ALL!" },
    setup: "A client says your team took four days to answer a simple question. The email sat in an inbox nobody owned.",
    prompt: "How do you reply?",
    best: [
      "Thank you for flagging this. We'll assign an owner so you always hear back within a day.",
      "You thank them (Appreciate) and commit to a specific fix (Accept or Decline).",
    ],
    missFirst: [
      "That was a shared-inbox issue, not us. We'll assign an owner going forward.",
      "You act on it, but making excuses instead of thanking them misses Appreciate.",
    ],
    missSecond: [
      "Thank you for your feedback! We value you as a client.",
      "Polite thanks, but no decision about what you'll change (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-legal-04",
    mode: "receiving",
    department: "Legal & Contracts",
    villain: { name: "Lady Yes-to-Everything", emoji: "🙋", title: "Taker of All Advice", taunt: "Say yes to all!" },
    setup: "A peer suggests adding a 10-page glossary to every contract. Clients already say your contracts are too long.",
    prompt: "How do you respond?",
    best: [
      "Thanks for the idea. Clients already find contracts long, so I'll skip the glossary.",
      "You thank them (Appreciate) and decline with a clear reason, which is allowed (Accept or Decline).",
    ],
    missFirst: [
      "That's a terrible idea. Our contracts are long enough already.",
      "Declining is fine, but calling it terrible skips any thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks, great idea! I'll add it to every contract.",
      "Adding pages clients don't want, without weighing it, misses Accept or Decline.",
    ],
  }),
  floor({
    id: "r-train-05",
    mode: "receiving",
    department: "Training",
    villain: { name: "Professor Pout", emoji: "😤", title: "Sulker of Surveys", taunt: "Sulk about it!" },
    setup: "Your workshop survey says you go too fast and need more hands-on practice. It stings.",
    prompt: "How do you respond?",
    best: [
      "Thanks, everyone. That's fair; next time I'll slow down and add two practice breaks.",
      "You thank them (Appreciate) and choose specific changes (Accept or Decline).",
    ],
    missFirst: [
      "They just didn't prepare. Fine, I'll add a practice break.",
      "You make a change, but blaming them instead of thanking them misses Appreciate.",
    ],
    missSecond: [
      "Thanks for the feedback, everyone! Really appreciate it.",
      "Warm thanks, but you never say what you'll do (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-exec-06",
    mode: "receiving",
    department: "Executive Suite",
    villain: { name: "The Shiny Object Sorcerer", emoji: "✨", title: "Conjurer of Switches", taunt: "Switch it all now!" },
    setup: "A VP wants your reports moved to a new tool right now. Switching this week risks errors in three reports due Friday.",
    prompt: "What do you tell the VP?",
    best: [
      "Thanks, I like the tool. I'll switch after Friday's reports so we avoid errors.",
      "You thank them (Appreciate) and choose a better timing with a reason (Accept or Decline).",
    ],
    missFirst: [
      "Now? In the middle of close? No way. Maybe after Friday.",
      "The timing is sensible, but the brush-off has no thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks! I'll switch everything over today.",
      "Rushing into a switch that risks Friday's reports skips weighing it (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-sales-07",
    mode: "receiving",
    department: "Sales",
    villain: { name: "Sir Shrugs-a-Lot", emoji: "🤷", title: "Knight of Meh", taunt: "Shrug it off!" },
    setup: "After your sales call, a senior rep says you interrupted the client three times. It's awkward to hear.",
    prompt: "How do you respond?",
    best: [
      "Thanks for catching that. You're right; I'll pause before I speak on the next call.",
      "You thank them (Appreciate) and decide on a specific change (Accept or Decline).",
    ],
    missFirst: [
      "I was just keeping the call moving. But okay, I'll interrupt less.",
      "You make a choice, but the excuse replaces any thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks for joining my call! See you at the next one.",
      "Friendly, but you never respond to the feedback itself (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-mkt-08",
    mode: "receiving",
    department: "Marketing",
    villain: { name: "The Eye-Roll Elemental", emoji: "🙄", title: "Spirit of Sighs", taunt: "Roll your eyes!" },
    setup: "A designer says your webinar slides use five different fonts and don't match the brand guide.",
    prompt: "How do you respond?",
    best: [
      "Thanks for the catch. You're right; I'll switch to the two brand fonts before Thursday.",
      "You thank them (Appreciate) and decide on a clear fix (Accept or Decline).",
    ],
    missFirst: [
      "Fonts are a matter of taste. Fine, I'll use the brand ones.",
      "You decide, but brushing them off skips any thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks! I'll keep that in mind someday.",
      "Polite, but “someday” is not a decision (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-mkt-09",
    mode: "receiving",
    department: "Marketing",
    villain: { name: "Captain Defensive", emoji: "🧱", title: "Builder of Walls", taunt: "Defend! Defend!" },
    setup: "A teammate says your email subject lines are too long and may be hurting open rates.",
    prompt: "How do you respond?",
    best: [
      "Thanks for the tip. I'll test shorter subject lines on the next two emails.",
      "You thank them (Appreciate) and choose a concrete way to try it (Accept or Decline).",
    ],
    missFirst: [
      "My subject lines are fine. I'll test short ones, I guess.",
      "You try it, but the defensive tone has no thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks for the input, I really appreciate it!",
      "Warm thanks, but you never decide what to do (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-ap-10",
    mode: "receiving",
    department: "Accounts Payable",
    villain: { name: "The People-Pleaser Phantom", emoji: "🫥", title: "Taker of All Tasks", taunt: "Never say no!" },
    setup: "Your AP lead gives you five tips for your invoice process. Three fit well; two would add hours of work each week.",
    prompt: "How do you respond?",
    best: [
      "Thank you! I'll use the first three, but skip the other two since they'd add hours.",
      "You thank them (Appreciate) and accept some, decline some, with a reason (Accept or Decline).",
    ],
    missFirst: [
      "Five tips? I'm already swamped. I'll do three, that's it.",
      "Your choice is fair, but the grumbling has no thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thank you! I'll start all five today.",
      "Taking on hours of extra work without weighing it misses Accept or Decline.",
    ],
  }),
  floor({
    id: "r-data-11",
    mode: "receiving",
    department: "Data & Reporting",
    villain: { name: "The Stonewall Sentinel", emoji: "🗿", title: "Works On My Machine", taunt: "Works for me!" },
    setup: "A coworker says clients find your dashboard filters confusing and asks if there could be a simpler view.",
    prompt: "How do you respond?",
    best: [
      "Thanks for passing that on. I'll add a simple default view and keep the full filters too.",
      "You thank them (Appreciate) and choose a clear fix (Accept or Decline).",
    ],
    missFirst: [
      "It works fine for me. I'll add a simple view if I have to.",
      "You act on it, but the brush-off has no thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thank you for the feedback! Clients are so important.",
      "Polite, but you never say what you'll do (misses Accept or Decline).",
    ],
  }),
  floor({
    id: "r-pm-12",
    mode: "receiving",
    department: "Project Management",
    villain: { name: "The Guilt Goblin", emoji: "👺", title: "No Means Yes", taunt: "You can't say no!" },
    setup: "A colleague suggests daily video stand-ups for your team. Your team works across three time zones.",
    prompt: "How do you respond?",
    best: [
      "Thanks! Daily calls won't work across time zones, so I'll try daily chat updates instead.",
      "You thank them (Appreciate) and adapt the idea with a clear reason (Accept or Decline).",
    ],
    missFirst: [
      "Daily calls across three time zones? Obviously not. We'll stay weekly.",
      "Declining is fine, but “obviously not” skips any thanks (misses Appreciate).",
    ],
    missSecond: [
      "Thanks! Daily calls for everyone, starting tomorrow.",
      "Ignoring the time-zone problem means you didn't weigh it (misses Accept or Decline).",
    ],
  }),
];

export const REGULAR_FLOORS: RegularFloor[] = [...GIVING, ...RECEIVING];

// ---------------------------------------------------------------------------------------------
// BOSS FLOORS (2 receiving, 2 giving) — the player writes their own words
// ---------------------------------------------------------------------------------------------
const BOSS_PROMPT = "Write what you'd say.";

export const BOSS_FLOORS_CONTENT: BossFloor[] = [
  {
    id: "boss-r-review",
    kind: "boss",
    mode: "receiving",
    department: "Executive Suite",
    villain: { name: "The Doom Director", emoji: "🦹", title: "Overlord of Reviews", taunt: "Defend or crumble!" },
    setup:
      "Your director says your client presentations run long and wants five-slide decks. Length is fair, but five slides is too few for audits.",
    prompt: BOSS_PROMPT,
    placeholder: "Thank you for...",
    exemplar:
      "Thank you for being direct. You're right they run long, so I'll cap them at 20 minutes. I'll keep more than five slides for audits, since clients need the walkthrough.",
  },
  {
    id: "boss-r-client",
    kind: "boss",
    mode: "receiving",
    department: "Client Success",
    villain: { name: "The Board of Dread", emoji: "🏛️", title: "Zero Patience", taunt: "Grovel or fight!" },
    setup:
      "A client's CFO says your rollout is a mess and wants to go back to paper. One approver wasn't set up, and paper would undo months of progress.",
    prompt: BOSS_PROMPT,
    placeholder: "Thank you for...",
    exemplar:
      "Thank you for flagging this. You're right, one approver wasn't set up, and we'll fix it today. I'd recommend we don't go back to paper, since it would undo your time savings.",
  },
  {
    id: "boss-g-handoff",
    kind: "boss",
    mode: "giving",
    department: "Project Management",
    villain: { name: "The Micromanager Minotaur", emoji: "🐂", title: "Lord of Blame", taunt: "Shout it loud!" },
    setup:
      "Priya, a capable new analyst, handed off a client file with no notes for the third time. You lost an hour, and the deadline is Monday.",
    prompt: BOSS_PROMPT,
    placeholder: "Hi Priya...",
    exemplar:
      "Hi Priya, your work on this file was solid. For handoffs, could you add three lines up top: what's done, what's pending, and any client quirks? Happy to walk through one Thursday.",
  },
  {
    id: "boss-g-rooftop",
    kind: "boss",
    mode: "giving",
    department: "The Rooftop",
    villain: { name: "The Doom Director", emoji: "🦹", title: "Ruler of Do Better", taunt: "Prove me wrong!" },
    setup:
      "Tom's quarterly numbers were right, but he read every slide aloud, skipped the cash-flow risk, and ran 15 minutes over. He asks for feedback.",
    prompt: BOSS_PROMPT,
    placeholder: "Thanks for asking, Tom...",
    exemplar:
      "Your numbers were airtight, Tom. Next time, open with three takeaways, including the cash-flow risk, and aim for 20 minutes. I'm happy to do a timed run-through with you.",
  },
];
