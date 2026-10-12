// Floor content for Olsen Tower of Doom.
// 24 regular floors (12 giving: 8 choose + 4 spot; 12 receiving: 8 choose + 4 spot) and 4 boss floors.
// Giving feedback  -> Assist + Actionable.   Receiving feedback -> Appreciate + Accept or Decline.
import { MODE_AS, type AKey, type BossFloor, type Choice, type Mode, type RegularFloor } from "@/lib/types";

// ---------------------------------------------------------------------------------------------
// Spot-floor helper. A spot floor shows a quote and asks which A it missed. Each verdict states
// whether each of the mode's two A's is present; a verdict "hits" an A when it judges that A the
// same way the truth does, and "misses" it otherwise. So the correct verdict always hits both.
// ---------------------------------------------------------------------------------------------
type Verdict = "missedFirst" | "missedSecond" | "missedBoth" | "nailedBoth";

const VERDICT_PRESENCE: Record<Verdict, readonly [boolean, boolean]> = {
  missedFirst: [false, true],
  missedSecond: [true, false],
  missedBoth: [false, false],
  nailedBoth: [true, true],
};

const VERDICT_ORDER: readonly Verdict[] = ["missedFirst", "missedSecond", "missedBoth", "nailedBoth"];

const VERDICT_LABELS: Record<Mode, Record<Verdict, string>> = {
  giving: {
    missedFirst: "Missed Assist",
    missedSecond: "Missed Actionable",
    missedBoth: "Missed both",
    nailedBoth: "Nailed both",
  },
  receiving: {
    missedFirst: "Missed Appreciate",
    missedSecond: "Missed Accept or Decline",
    missedBoth: "Missed both",
    nailedBoth: "Nailed both",
  },
};

function spotChoices(mode: Mode, truth: Verdict, explanations: Record<Verdict, string>): Choice[] {
  const keys = MODE_AS[mode];
  const truthPresence = VERDICT_PRESENCE[truth];
  return VERDICT_ORDER.map((verdict, i) => {
    const presence = VERDICT_PRESENCE[verdict];
    const hits: AKey[] = [];
    const misses: AKey[] = [];
    keys.forEach((key, k) => (presence[k] === truthPresence[k] ? hits : misses).push(key));
    return {
      id: String.fromCharCode(97 + i), // a, b, c, d
      text: VERDICT_LABELS[mode][verdict],
      correct: verdict === truth,
      hits,
      misses,
      explanation: explanations[verdict],
      present: keys.filter((_, k) => presence[k]),
    };
  });
}

const SPOT_PROMPT_GIVING = "Which A did this feedback miss?";
const SPOT_PROMPT_RECEIVING = "Which A did this reaction miss?";

// ---------------------------------------------------------------------------------------------
// GIVING FEEDBACK — choose (8)
// ---------------------------------------------------------------------------------------------
const GIVING_CHOOSE: RegularFloor[] = [
  {
    id: "g-ap-01",
    kind: "choose",
    mode: "giving",
    department: "Accounts Payable — Floor of Endless Invoices",
    villain: {
      name: "Sir Rants-a-Lot",
      emoji: "🗯️",
      title: "Knight of the Angry Reply-All",
      taunt: "Why help when you can VENT? Caps lock is a leadership style!",
    },
    setup:
      "Your teammate Jordan coded twelve vendor invoices to the wrong GL accounts, and you spent your morning fixing them before the payment run. Jordan is new to AP.",
    prompt: "What do you say to Jordan?",
    choices: [
      {
        id: "a",
        text: "“I lost my whole morning fixing your coding. Seriously, Jordan, this is basic stuff.”",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "That's venting, not helping (misses Assist), and “this is basic stuff” gives Jordan nothing concrete to change (misses Actionable).",
      },
      {
        id: "b",
        text: "“I'd like to help you nail coding. Let's add the GL cheat sheet to your desk and do a 15-minute check of your batch before Thursday's run.”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "It's framed around Jordan's growth (Assist) and gives two concrete steps with a time: a cheat sheet and a pre-run check (Actionable).",
      },
      {
        id: "c",
        text: "“No worries at all! Coding is tricky. Just try to be a little more careful next time, okay?”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Kind and supportive (Assist), but “be more careful” isn't a step Jordan can actually do (misses Actionable).",
      },
      {
        id: "d",
        text: "“Use the cheat sheet. Every invoice. If I have to fix this again, it goes to the manager.”",
        correct: false,
        hits: ["actionable"],
        misses: ["assist"],
        explanation:
          "The step is concrete (Actionable), but the threat makes it about your frustration, not Jordan's improvement (misses Assist).",
      },
    ],
  },
  {
    id: "g-cs-02",
    kind: "choose",
    mode: "giving",
    department: "Client Success — Floor of Lingering Demos",
    villain: {
      name: "The Monologue Monster",
      emoji: "👾",
      title: "Devourer of Client Attention",
      taunt: "Just tell them it was 'a bit long'. They'll figure out the rest!",
    },
    setup:
      "Your colleague Aisha ran a client demo of the new AP automation workflow. It ran 25 minutes over, and the client's CFO left before the pricing slide. Aisha asks how it went.",
    prompt: "What feedback do you give Aisha?",
    choices: [
      {
        id: "a",
        text: "“It was great overall! Maybe just a bit long? Something to think about.”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Friendly (Assist), but “a bit long, something to think about” leaves Aisha guessing what to change (misses Actionable).",
      },
      {
        id: "b",
        text: "“We lost the CFO. That demo was painful to sit through, honestly.”",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "This reacts with frustration instead of helping (misses Assist) and offers no next step (misses Actionable).",
      },
      {
        id: "c",
        text: "“Your workflow walkthrough was clear! Next time, let's cap the demo at 30 minutes and put pricing at minute 20. Want to rehearse Tuesday?”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "It builds on what worked and offers to rehearse (Assist), with a time cap and a slide order Aisha can use (Actionable).",
      },
    ],
  },
  {
    id: "g-close-03",
    kind: "choose",
    mode: "giving",
    department: "Month-End Close — Floor of Unbalanced Ledgers",
    villain: {
      name: "Baron Blame",
      emoji: "🫵",
      title: "Pointer of Fingers",
      taunt: "Find the culprit! Feedback is just blame with extra steps.",
    },
    setup:
      "Ravi's bank reconciliation is off by $4,312, and there's no note explaining the reconciling items. Close is in two days and you're reviewing his work.",
    prompt: "What do you tell Ravi?",
    choices: [
      {
        id: "a",
        text: "“This rec is a mess. Whose fault do you think it'll be if close slips?”",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "Blame isn't help (misses Assist), and calling it “a mess” doesn't tell Ravi what to fix (misses Actionable).",
      },
      {
        id: "b",
        text: "“Fix the variance and add notes. Today.”",
        correct: false,
        hits: ["actionable"],
        misses: ["assist"],
        explanation:
          "Clear tasks (Actionable), but the curt order shows no interest in helping Ravi get better at recs (misses Assist).",
      },
      {
        id: "c",
        text: "“Thanks for getting this started! I'm sure you'll sort it out, you always do.”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Encouraging (Assist), but it never mentions the $4,312 gap or what to do about it (misses Actionable).",
      },
      {
        id: "d",
        text: "“Let's get this rec close-ready together. Can you list each reconciling item with a one-line note, then tie out the $4,312 by tomorrow noon?”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "“Together” signals support (Assist), and Ravi knows exactly what to do and by when: itemize, annotate, tie out (Actionable).",
      },
    ],
  },
  {
    id: "g-it-04",
    kind: "choose",
    mode: "giving",
    department: "IT Help Desk — Floor of Infinite Reboots",
    villain: {
      name: "The Ghost Reviewer",
      emoji: "👻",
      title: "Haunter of Unspoken Opinions",
      taunt: "Say nothing. Sigh loudly. They'll sense it eventually...",
    },
    setup:
      "Help desk tech Mei closed your VPN ticket as “resolved” with no notes, but the VPN still drops every hour. Her team lead asks if you have any feedback for her.",
    prompt: "What do you share?",
    choices: [
      {
        id: "a",
        text: "“Nah, it's fine.” (Then you complain about it in the team chat.)",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "Ghosting and venting elsewhere helps no one (misses Assist) and gives Mei nothing to act on (misses Actionable).",
      },
      {
        id: "b",
        text: "“Mei was friendly! Maybe a bit quick to close things, but overall good.”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Kind (Assist), but “a bit quick” is too vague for Mei to change anything (misses Actionable).",
      },
      {
        id: "c",
        text: "“Could Mei confirm the fix with the user before closing and add a one-line note on what was changed? My VPN still drops hourly.”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "It's aimed at improving the process, not venting (Assist), with two specific habits plus the facts needed to reopen (Actionable).",
      },
      {
        id: "d",
        text: "“Mei needs to test fixes before closing tickets. My VPN still drops hourly. Not great, honestly.”",
        correct: false,
        hits: ["actionable"],
        misses: ["assist"],
        explanation:
          "There's a concrete step (Actionable), but “not great, honestly” reads as a complaint, not an effort to help Mei grow (misses Assist).",
      },
    ],
  },
  {
    id: "g-sales-05",
    kind: "choose",
    mode: "giving",
    department: "Sales — Floor of Pipeline Peril",
    villain: {
      name: "Count Nitpick",
      emoji: "🧛",
      title: "Drainer of Morale, One Comma at a Time",
      taunt: "List EVERY flaw. Forty-seven bullet points is thorough, not cruel!",
    },
    setup:
      "Diego's proposal deck for a big AP automation prospect has 38 slides, tiny fonts, and the ROI number is buried on slide 31. He asks you to review it before tomorrow's pitch.",
    prompt: "What feedback do you give Diego?",
    choices: [
      {
        id: "a",
        text: "“Bump the fonts on slides 3 and 4 to 18pt, swap the old logo on 7, fix the comma on 9, recolor the chart on 12... honestly, where do I even start?”",
        correct: false,
        hits: ["actionable"],
        misses: ["assist"],
        explanation:
          "Every fix is concrete (Actionable), but a sigh-filled wall of nitpicks the night before a pitch overwhelms rather than helps, and it skips the buried ROI that matters most (misses Assist).",
      },
      {
        id: "b",
        text: "“Love the energy! It just needs to pop more. You've got this!”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Encouraging (Assist), but “pop more” can't be acted on the night before a pitch (misses Actionable).",
      },
      {
        id: "c",
        text: "“Your ROI case is strong, so let's lead with it. Move slide 31 to slide 2 and cut to the 12 slides the client needs. I can help trim tonight.”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "It highlights a strength and offers help (Assist), then names the top two changes that matter most (Actionable).",
      },
    ],
  },
  {
    id: "g-data-06",
    kind: "choose",
    mode: "giving",
    department: "Data & Reporting — Floor of Broken Formulas",
    villain: {
      name: "The Sarcasm Sphinx",
      emoji: "😼",
      title: "Asker of Rhetorical Riddles",
      taunt: "Wow, great spreadsheet. Said no one. Ever. Heh.",
    },
    setup:
      "Lena built the client KPI spreadsheet, but the totals are hard-coded, so they broke when new data was pasted in. The client spotted the wrong numbers first.",
    prompt: "What do you say to Lena?",
    choices: [
      {
        id: "a",
        text: "“Wow, hard-coded totals. Bold choice. The client sure enjoyed that.”",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "Sarcasm stings without helping (misses Assist) and doesn't say what to do instead (misses Actionable).",
      },
      {
        id: "b",
        text: "“Spreadsheets are hard, don't stress! Just double-check things going forward.”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Reassuring (Assist), but “double-check things” is too vague to prevent the next break (misses Actionable).",
      },
      {
        id: "c",
        text: "“Replace every total with SUM formulas and add a check cell. Clients should never catch our errors.”",
        correct: false,
        hits: ["actionable"],
        misses: ["assist"],
        explanation:
          "Concrete fixes (Actionable), but the scolding close makes it a reprimand, not support (misses Assist).",
      },
      {
        id: "d",
        text: "“I want your sheet to be bulletproof. Could you swap the hard-coded totals for SUM formulas and add a check cell that flags mismatches? I'll share a template.”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "Offers help and a template (Assist), plus two exact changes that stop this happening again (Actionable).",
      },
    ],
  },
  {
    id: "g-pm-07",
    kind: "choose",
    mode: "giving",
    department: "Project Management — Floor of Slipping Gantt Charts",
    villain: {
      name: "The Deadline Dragon",
      emoji: "🐲",
      title: "Scorcher of Status Meetings",
      taunt: "Breathe fire in the stand-up! Public roasting builds character!",
    },
    setup:
      "Marcus missed the data-migration milestone by a week and didn't flag it until the day it was due, so the client launch slipped. You lead the project.",
    prompt: "What feedback do you give Marcus, one-on-one?",
    choices: [
      {
        id: "a",
        text: "“Next time you're at risk, flag it in our Monday check-in at least five days ahead, and we'll re-plan together. How can I make that easier?”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "Asking how to make it easier is support (Assist), and the rule is concrete: flag at Monday check-in, five days ahead (Actionable).",
      },
      {
        id: "b",
        text: "“You blindsided everyone. I had to apologize to the client because of you.”",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "This unloads your frustration (misses Assist) and says nothing about what Marcus should do next time (misses Actionable).",
      },
      {
        id: "c",
        text: "“These things happen. Just communicate a bit better going forward.”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Gracious (Assist), but “communicate better” doesn't say when, how, or to whom (misses Actionable).",
      },
    ],
  },
  {
    id: "g-mkt-08",
    kind: "choose",
    mode: "giving",
    department: "Marketing — Floor of Forgotten Calls-to-Action",
    villain: {
      name: "Lady Looks-Great",
      emoji: "🍵",
      title: "Duchess of Lukewarm Praise",
      taunt: "Just say 'looks great!' Honesty is so... awkward.",
    },
    setup:
      "Priya's client newsletter is nearly ready, but the “Book a demo” link is buried in paragraph six and the subject line is 14 words long. She asks for a quick look.",
    prompt: "What do you tell Priya?",
    choices: [
      {
        id: "a",
        text: "“Looks great! Maybe tighten it up a little? Up to you.”",
        correct: false,
        hits: ["assist"],
        misses: ["actionable"],
        explanation:
          "Warm (Assist), but “tighten it up” doesn't say what or where (misses Actionable).",
      },
      {
        id: "b",
        text: "“The writing is engaging! Two tweaks: make “Book a demo” a button in paragraph one, and cut the subject line to under 7 words. Want a second look after?”",
        correct: true,
        hits: ["assist", "actionable"],
        misses: [],
        explanation:
          "Leads with a strength and offers a re-review (Assist), with two precise edits Priya can make in minutes (Actionable).",
      },
      {
        id: "c",
        text: "“Who buries the CTA in paragraph six? Did anyone proofread this?”",
        correct: false,
        hits: [],
        misses: ["assist", "actionable"],
        explanation:
          "Rhetorical jabs are frustration, not help (misses Assist), and there's no clear fix offered (misses Actionable).",
      },
      {
        id: "d",
        text: "“Move the CTA up. Shorten the subject. Should've caught that yourself.”",
        correct: false,
        hits: ["actionable"],
        misses: ["assist"],
        explanation:
          "The edits are concrete (Actionable), but the jab at the end turns help into a put-down (misses Assist).",
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// GIVING FEEDBACK — spot (4)
// ---------------------------------------------------------------------------------------------
const GIVING_SPOT: RegularFloor[] = [
  {
    id: "g-train-09",
    kind: "spot",
    mode: "giving",
    department: "Training — Floor of Sleepy Workshops",
    villain: {
      name: "The Snark Knight",
      emoji: "🗡️",
      title: "Wielder of the Backhanded Compliment",
      taunt: "Specific AND savage. That's the dream, right?",
    },
    setup:
      "A teammate just ran their first client training on the AP portal, and half the room checked their phones. Here's the feedback a colleague gave them.",
    quote:
      "“Honestly, that was a snooze-fest. Next time cut it to 10 slides, add a hands-on exercise at minute 15, and rehearse once.”",
    prompt: SPOT_PROMPT_GIVING,
    choices: spotChoices("giving", "missedFirst", {
      missedFirst:
        "Right. The steps are concrete (Actionable), but “snooze-fest” comes from frustration, not a wish to help them improve (misses Assist).",
      missedSecond:
        "Not quite. Ten slides, an exercise at minute 15, one rehearsal: that's very Actionable. The problem is the tone.",
      missedBoth:
        "Half right. The insult misses Assist, but the next steps are clear and concrete, so Actionable is there.",
      nailedBoth:
        "Close, but “snooze-fest” is venting. Assist means the feedback is meant to help, and an insult undercuts that.",
    }),
  },
  {
    id: "g-onb-10",
    kind: "spot",
    mode: "giving",
    department: "Onboarding — Floor of Lost New Hires",
    villain: {
      name: "The Vague-inator",
      emoji: "🌫️",
      title: "Lord of the Fog of Feedback",
      taunt: "Be supportive. Be positive. Be completely unclear!",
    },
    setup:
      "A new consultant asks how their first client kickoff went. They forgot to confirm the project timeline and the client left unsure about next steps. Here's what their buddy said.",
    quote:
      "“You did awesome for your first one! I'm totally here for you. Just keep growing into the role and it'll click.”",
    prompt: SPOT_PROMPT_GIVING,
    choices: spotChoices("giving", "missedSecond", {
      missedFirst:
        "Not this one. It's warm and supportive, so Assist is there. What's missing is any concrete step.",
      missedSecond:
        "Right. Supportive (Assist), but nothing about confirming the timeline or recapping next steps (misses Actionable).",
      missedBoth:
        "Half right. It's vague (misses Actionable), but the intent to support them is genuine, so Assist is there.",
      nailedBoth:
        "Kindness alone isn't enough. “Keep growing” gives no step to take, like confirming the timeline in the next kickoff.",
    }),
  },
  {
    id: "g-legal-11",
    kind: "spot",
    mode: "giving",
    department: "Legal & Contracts — Floor of Fine Print",
    villain: {
      name: "The Eye-Roll Oracle",
      emoji: "🔮",
      title: "Seer of Nothing Specific",
      taunt: "Sigh deeply. Mutter 'it's just not it.' They'll know.",
    },
    setup:
      "A colleague redlined a client's statement of work but missed the payment-terms clause. Here's the feedback they got from the reviewer.",
    quote: "“Ugh. This redline is just... not it. You know what I mean. Do better.”",
    prompt: SPOT_PROMPT_GIVING,
    choices: spotChoices("giving", "missedBoth", {
      missedFirst:
        "True, the “Ugh” misses Assist, but there's more: “not it” and “do better” give no concrete step either.",
      missedSecond:
        "True, it's not Actionable, but the frustrated “Ugh... do better” also misses Assist.",
      missedBoth:
        "Right. It vents instead of helping (misses Assist) and never mentions the payment-terms clause or a fix (misses Actionable).",
      nailedBoth:
        "Not even close. No help, no steps. Try: “Can you add the Net 30 payment terms in section 4 before it goes out?”",
    }),
  },
  {
    id: "g-exec-12",
    kind: "spot",
    mode: "giving",
    department: "Executive Suite — Floor of Board Memos",
    villain: {
      name: "The Doubt Demon",
      emoji: "😈",
      title: "Whisperer of 'Something's Wrong Here'",
      taunt: "Good feedback? Impossible. There must be a flaw. Find it!",
    },
    setup:
      "An analyst wrote a board memo with excellent analysis, but the recommendation is on page four. Here's the feedback their director gave.",
    quote:
      "“Your analysis deserves to land. Could you put the recommendation in the first line and move the methodology to an appendix? Happy to review a draft Friday.”",
    prompt: SPOT_PROMPT_GIVING,
    choices: spotChoices("giving", "nailedBoth", {
      missedFirst:
        "Look again: it praises the analysis and offers a Friday review. That's Assist: feedback meant to help them succeed.",
      missedSecond:
        "Look again: recommendation first line, methodology to an appendix. Those are concrete steps, so it's Actionable.",
      missedBoth:
        "This one's a model answer: supportive and offering help (Assist), with two clear edits (Actionable).",
      nailedBoth:
        "Right. It's in service of their success with an offer to help (Assist), plus specific edits and a date (Actionable).",
    }),
  },
];

// ---------------------------------------------------------------------------------------------
// RECEIVING FEEDBACK — choose (8)   (r-legal-04 and r-exec-06: the best answer is a reasoned decline)
// ---------------------------------------------------------------------------------------------
const RECEIVING_CHOOSE: RegularFloor[] = [
  {
    id: "r-onb-01",
    kind: "choose",
    mode: "receiving",
    department: "Onboarding — Floor of Lost New Hires",
    villain: {
      name: "The Excuse Engine",
      emoji: "⚙️",
      title: "Generator of Infinite 'Buts'",
      taunt: "Feedback incoming! Deploy excuses! All of them!",
    },
    setup:
      "Your manager says your client onboarding checklist has 60 steps and new clients find it overwhelming. She suggests grouping it into five phases.",
    prompt: "How do you respond?",
    choices: [
      {
        id: "a",
        text: "“Well, clients never read anything anyway. And I built it in a rush because nobody gave me time.”",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "Excuses replace any thanks (misses Appreciate), and the idea is brushed off without being weighed (misses Accept or Decline).",
      },
      {
        id: "b",
        text: "“Thank you, that's useful. Five phases makes sense. I'll regroup it this week and keep the detailed steps as a linked appendix.”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "A clear thank-you (Appreciate) and a considered choice to adopt the idea, with your own tweak to keep the details (Accept or Decline).",
      },
      {
        id: "c",
        text: "“Oh, totally, thanks! I'll scrap it and rebuild from scratch however you want.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "Gracious (Appreciate), but scrapping everything without weighing what works isn't a reasoned choice (misses Accept or Decline).",
      },
    ],
  },
  {
    id: "r-close-02",
    kind: "choose",
    mode: "receiving",
    department: "Month-End Close — Floor of Unbalanced Ledgers",
    villain: {
      name: "The Bobblehead Baron",
      emoji: "🪆",
      title: "Nodder at All Things",
      taunt: "Just nod! Agree to everything! Thinking is overrated!",
    },
    setup:
      "Your controller reviews your month-end report and says: add variance commentary for anything over 10%, switch to landscape, and rename every tab. You agree with the first two points, but renaming the tabs would break your ERP export.",
    prompt: "What do you say?",
    choices: [
      {
        id: "a",
        text: "“Thanks so much! I'll do all three right away.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "Nice thank-you (Appreciate), but saying yes to everything without weighing each point skips Accept or Decline.",
      },
      {
        id: "b",
        text: "“The format is fine. People are used to it.”",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "No thanks (misses Appreciate), and it dismisses all three points, even the one you agree with (misses Accept or Decline).",
      },
      {
        id: "c",
        text: "“Thank you for the thorough review! I'll add variance commentary and switch to landscape. I'd keep the tab names, though: our ERP export depends on them.”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You thank them (Appreciate), adopt the two useful points, and decline the third with a real reason (Accept or Decline).",
      },
      {
        id: "d",
        text: "“Variance commentary, sure. Landscape is fine too. But I'm not renaming tabs; the ERP export depends on them.”",
        correct: false,
        hits: ["acceptOrDecline"],
        misses: ["appreciate"],
        explanation:
          "You weigh each point and give a real reason (Accept or Decline), but there's no thank-you for the review (misses Appreciate).",
      },
    ],
  },
  {
    id: "r-cs-03",
    kind: "choose",
    mode: "receiving",
    department: "Client Success — Floor of Lingering Demos",
    villain: {
      name: "The Inbox Inferno",
      emoji: "🔥",
      title: "Blazer of ALL-CAPS Subject Lines",
      taunt: "They yelled first! Fight fire with fire!",
    },
    setup:
      "A client emails: “Your team took FOUR DAYS to answer a simple invoice question. Unacceptable.” Looking into it, the ticket sat in a shared inbox no one owned.",
    prompt: "How do you reply?",
    choices: [
      {
        id: "a",
        text: "“Thank you for telling us directly. You're right, four days is too long. We've assigned an owner to that inbox and will reply within one business day.”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You thank them despite the heat (Appreciate) and act on the valid point with a specific change (Accept or Decline).",
      },
      {
        id: "b",
        text: "“To be fair, your question came in on a Friday before a long weekend.”",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "Defending instead of thanking (misses Appreciate), and the real issue goes unexamined (misses Accept or Decline).",
      },
      {
        id: "c",
        text: "“Thanks for the feedback! We value all input.” (Nothing changes.)",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "A thank-you (Appreciate), but no reflection or decision about the slow-response problem (misses Accept or Decline).",
      },
    ],
  },
  {
    id: "r-legal-04",
    kind: "choose",
    mode: "receiving",
    department: "Legal & Contracts — Floor of Fine Print",
    villain: {
      name: "Lady Yes-to-Everything",
      emoji: "🙋",
      title: "Collector of Unweighed Advice",
      taunt: "A peer suggested it, so you MUST do it. Those are the rules!",
    },
    setup:
      "A peer suggests attaching a 10-page legal glossary to every statement of work. You weigh it: clients already complain SOWs are too long, and most terms are defined in the master agreement.",
    prompt: "What's your best response?",
    choices: [
      {
        id: "a",
        text: "“Sure, thanks! I'll add it to every SOW from now on.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "Grateful (Appreciate), but you're accepting something you have good reasons to doubt, without weighing it (misses Accept or Decline).",
      },
      {
        id: "b",
        text: "“Thanks for thinking about clarity. I'm going to pass on the glossary since the MSA covers those terms, but I'll add a one-line link to it in each SOW.”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You thank them (Appreciate) and make a reasoned decline, explaining why and keeping what's useful (Accept or Decline). Declining is allowed!",
      },
      {
        id: "c",
        text: "“No. SOWs are long enough already.”",
        correct: false,
        hits: ["acceptOrDecline"],
        misses: ["appreciate"],
        explanation:
          "There's a reason behind the decline (Accept or Decline), but no thank-you for the input (misses Appreciate).",
      },
      {
        id: "d",
        text: "“Thanks so much for the idea! I'll pass, though.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "A real thank-you (Appreciate), but a quick “I'll pass” with no reasoning isn't a considered decision (misses Accept or Decline).",
      },
    ],
  },
  {
    id: "r-train-05",
    kind: "choose",
    mode: "receiving",
    department: "Training — Floor of Sleepy Workshops",
    villain: {
      name: "Professor Pout",
      emoji: "😤",
      title: "Sulker of the Survey Results",
      taunt: "Low score? Clearly the attendees are wrong.",
    },
    setup:
      "Survey results from your Excel workshop say you go too fast and need more hands-on practice. It stings: you spent weeks on those slides.",
    prompt: "What do you tell the training coordinator who shared the results?",
    choices: [
      {
        id: "a",
        text: "“Some people just aren't Excel people. I can't slow down for everyone.”",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "No gratitude (misses Appreciate), and blaming the attendees means you never weigh the feedback (misses Accept or Decline).",
      },
      {
        id: "b",
        text: "“Thank you for passing these on, even if they stung. I'll cut five slides and add two practice exercises for the next session.”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You thank them even when it's uncomfortable (Appreciate) and decide on concrete changes after weighing it (Accept or Decline).",
      },
      {
        id: "c",
        text: "“Thanks! I'll redo the whole workshop and double its length so nobody's ever lost.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "Grateful (Appreciate), but overcorrecting without weighing it isn't a thoughtful choice (misses Accept or Decline).",
      },
    ],
  },
  {
    id: "r-exec-06",
    kind: "choose",
    mode: "receiving",
    department: "Executive Suite — Floor of Board Memos",
    villain: {
      name: "The Shiny Object Sorcerer",
      emoji: "✨",
      title: "Conjurer of Mid-Quarter Migrations",
      taunt: "A VP said it! Drop everything and switch tools NOW!",
    },
    setup:
      "A VP suggests moving your client reporting to a new BI tool right away. You like the tool, but switching mid-close would risk errors in three client reports due Friday.",
    prompt: "How do you respond?",
    choices: [
      {
        id: "a",
        text: "“Absolutely, thank you! I'll migrate everything this week.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "Grateful (Appreciate), but agreeing without weighing the close-week risk isn't a reasoned choice (misses Accept or Decline).",
      },
      {
        id: "b",
        text: "“We don't have time for new tools. Maybe never.”",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "No thanks (misses Appreciate), and a blanket “never” dismisses the idea without weighing it (misses Accept or Decline).",
      },
      {
        id: "c",
        text: "“Thank you, I like that tool. I'll hold off until after Friday's reports to avoid errors, then pilot it on one client next month.”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You thank them (Appreciate), decline the timing for a clear reason, and choose your own path forward (Accept or Decline).",
      },
    ],
  },
  {
    id: "r-sales-07",
    kind: "choose",
    mode: "receiving",
    department: "Sales — Floor of Pipeline Peril",
    villain: {
      name: "Sir Shrugs-a-Lot",
      emoji: "🤷",
      title: "Knight of the Non-Response",
      taunt: "Shrug it off. If you don't think about it, it isn't real!",
    },
    setup:
      "After shadowing your discovery call, a senior rep says you interrupted the prospect three times while they described their invoice backlog. It's awkward to hear.",
    prompt: "What do you say?",
    choices: [
      {
        id: "a",
        text: "“Huh. Okay.” (You move on to the next agenda item.)",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "No thank-you (misses Appreciate), and shrugging it off means you never weigh the feedback (misses Accept or Decline).",
      },
      {
        id: "b",
        text: "“I was just trying to show I understood their problem. That's what good reps do.”",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "Defending instead of thanking (misses Appreciate), and justifying shuts down any real reflection (misses Accept or Decline).",
      },
      {
        id: "c",
        text: "“Thanks, I didn't notice that. I'll try pausing two seconds before I speak on my next three calls. Can you listen in on one?”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You thank them for an awkward truth (Appreciate) and choose a specific way to act on it (Accept or Decline).",
      },
      {
        id: "d",
        text: "“Thank you! You're right, I'll stop talking on calls and let you lead from now on.”",
        correct: false,
        hits: ["appreciate"],
        misses: ["acceptOrDecline"],
        explanation:
          "Grateful (Appreciate), but overreacting instead of weighing what the feedback actually asked for misses Accept or Decline.",
      },
    ],
  },
  {
    id: "r-mkt-08",
    kind: "choose",
    mode: "receiving",
    department: "Marketing — Floor of Forgotten Calls-to-Action",
    villain: {
      name: "The Eye-Roll Elemental",
      emoji: "🙄",
      title: "Spirit of the Silent Sigh",
      taunt: "Roll your eyes. Say 'fine.' Change nothing. Perfect.",
    },
    setup:
      "A designer says your webinar slides use five different fonts and look inconsistent next to the brand guide. You suspect they're right, though you liked the variety.",
    prompt: "How do you respond?",
    choices: [
      {
        id: "a",
        text: "“Fine. Whatever.” (Eye-roll included.)",
        correct: false,
        hits: [],
        misses: ["appreciate", "acceptOrDecline"],
        explanation:
          "An eye-roll isn't gratitude (misses Appreciate), and “whatever” skips any real decision (misses Accept or Decline).",
      },
      {
        id: "b",
        text: "“Thanks for catching that, you're right. I'll switch to our two brand fonts, but keep the title slide's display font since it's the webinar theme. OK?”",
        correct: true,
        hits: ["appreciate", "acceptOrDecline"],
        misses: [],
        explanation:
          "You say thank you (Appreciate), accept the core point, and make your own reasoned call on one exception (Accept or Decline).",
      },
      {
        id: "c",
        text: "“I picked those fonts on purpose. Variety keeps people awake, so I'm keeping them.”",
        correct: false,
        hits: ["acceptOrDecline"],
        misses: ["appreciate"],
        explanation:
          "You did give a reason (Accept or Decline), but skipping any thanks makes it sound defensive (misses Appreciate).",
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// RECEIVING FEEDBACK — spot (4)
// ---------------------------------------------------------------------------------------------
const RECEIVING_SPOT: RegularFloor[] = [
  {
    id: "r-mkt-09",
    kind: "spot",
    mode: "receiving",
    department: "Marketing — Campaign Command Floor",
    villain: {
      name: "Captain Defensive",
      emoji: "🧱",
      title: "Commander of the Comment Wall",
      taunt: "Shields up! Every suggestion is an attack!",
    },
    setup:
      "A teammate suggests your email subject lines are too long and might be hurting open rates. Here's how you replied.",
    quote:
      "“Well, nobody complained before. But fine, I'll A/B test a short version on the next send and keep whichever gets more opens.”",
    prompt: SPOT_PROMPT_RECEIVING,
    choices: spotChoices("receiving", "missedFirst", {
      missedFirst:
        "Right. Testing it is a smart, reasoned choice (Accept or Decline), but “nobody complained before” replaces a thank-you (misses Appreciate).",
      missedSecond:
        "Not this one. Running an A/B test is a thoughtful way to weigh the idea, so Accept or Decline is there.",
      missedBoth:
        "Half right. No thanks (misses Appreciate), but the A/B test is a genuine, reasoned decision.",
      nailedBoth:
        "Close, but there's no thank-you. A defensive opener misses Appreciate even when the follow-through is good.",
    }),
  },
  {
    id: "r-ap-10",
    kind: "spot",
    mode: "receiving",
    department: "Accounts Payable — Floor of Endless Invoices",
    villain: {
      name: "The People-Pleaser Phantom",
      emoji: "🫥",
      title: "Haunter of the Overloaded To-Do List",
      taunt: "Say yes to everything. Sleep is for people who say no.",
    },
    setup:
      "Your AP lead gives you five suggestions on your invoice workflow, from file naming to daily status emails. Some fit, some would add hours of work. Here's your reply.",
    quote:
      "“Thank you so much, this is amazing! I'll do all five, starting today. Daily emails, new names, new folders, all of it!”",
    prompt: SPOT_PROMPT_RECEIVING,
    choices: spotChoices("receiving", "missedSecond", {
      missedFirst:
        "Not this one. “Thank you so much” is plenty of Appreciate. The issue is what happens next.",
      missedSecond:
        "Right. Lots of thanks (Appreciate), but taking on all five without weighing which ones add value skips Accept or Decline.",
      missedBoth:
        "Half right. Saying yes to everything misses Accept or Decline, but the thank-you is genuine.",
      nailedBoth:
        "Enthusiasm isn't evaluation. Accept or Decline means weighing each idea and choosing, not agreeing to all of it.",
    }),
  },
  {
    id: "r-data-11",
    kind: "spot",
    mode: "receiving",
    department: "Data & Reporting — Floor of Broken Formulas",
    villain: {
      name: "The Stonewall Sentinel",
      emoji: "🗿",
      title: "Guardian of 'Works On My Machine'",
      taunt: "Your dashboard is perfect. Feedback bounces right off!",
    },
    setup:
      "A client success manager says your dashboard's filters confuse clients and asks if there's a simpler view. Here's how you reacted.",
    quote: "“Whatever. It's my dashboard and it works fine for me.”",
    prompt: SPOT_PROMPT_RECEIVING,
    choices: spotChoices("receiving", "missedBoth", {
      missedFirst:
        "True, there's no thank-you, but there's also no weighing of the idea. “Whatever” dismisses it outright.",
      missedSecond:
        "True, it's dismissed without reflection, but there's also no thank-you, so Appreciate is missing too.",
      missedBoth:
        "Right. No thanks (misses Appreciate), and it brushes the idea off without weighing it (misses Accept or Decline).",
      nailedBoth:
        "Not quite. Declining is allowed, but it needs a thank-you and real reasoning. “Works fine for me” is neither.",
    }),
  },
  {
    id: "r-pm-12",
    kind: "spot",
    mode: "receiving",
    department: "Project Management — Floor of Slipping Gantt Charts",
    villain: {
      name: "The Guilt Goblin",
      emoji: "👺",
      title: "Whisperer of 'You Can't Say No'",
      taunt: "Declining feedback? How rude! Surely that fails...",
    },
    setup:
      "A colleague suggests you switch your project team to daily stand-ups. Your team spans three time zones. Here's how you responded.",
    quote:
      "“Thanks for the suggestion, really. I thought it over, and with three time zones I'll keep stand-ups twice a week, but I'll add a shared async update board.”",
    prompt: SPOT_PROMPT_RECEIVING,
    choices: spotChoices("receiving", "nailedBoth", {
      missedFirst:
        "Look again: “Thanks for the suggestion, really” is a clear thank-you. Appreciate is there.",
      missedSecond:
        "Declining isn't failing. They weighed the idea, explained why, and chose an alternative. That IS Accept or Decline.",
      missedBoth:
        "This is a model reaction: a thank-you plus a reasoned, communicated decline with an alternative.",
      nailedBoth:
        "Right. A sincere thanks (Appreciate) and a reflective, reasoned choice to decline with an alternative (Accept or Decline).",
    }),
  },
];

export const REGULAR_FLOORS: RegularFloor[] = [
  ...GIVING_CHOOSE,
  ...GIVING_SPOT,
  ...RECEIVING_CHOOSE,
  ...RECEIVING_SPOT,
];

// ---------------------------------------------------------------------------------------------
// BOSS FLOORS (2 receiving, 2 giving) — the player writes their own words
// ---------------------------------------------------------------------------------------------
export const BOSS_FLOORS_CONTENT: BossFloor[] = [
  {
    id: "boss-r-review",
    kind: "boss",
    mode: "receiving",
    department: "Executive Suite — Hall of the Annual Review",
    villain: {
      name: "The Doom Director",
      emoji: "🦹",
      title: "Overlord of the Performance Review",
      taunt: "Defend yourself or crumble. Those are your ONLY options!",
    },
    setup:
      "In your annual review, your director says your client presentations run long and suggests cutting every deck to five slides. The point about length stings because it's partly true, but you think five slides is too few for complex audit findings.",
    prompt:
      "Write what you'd say back to your director (2-4 sentences). Show that you Appreciate the feedback, then Accept or Decline each part with your reasoning.",
    placeholder: "Thank you for... You're right that... I'll... but I'd like to keep... because...",
    exemplar:
      "Thank you for being direct with me; I'd rather hear it now than lose a client's attention. You're right that my presentations run long, so I'll cap them at 20 minutes and move the detail into an appendix. I'm going to keep more than five slides for complex audits, because clients need the reconciliation walkthrough, but I'll trim everything else and check in with you after the next one.",
  },
  {
    id: "boss-r-client",
    kind: "boss",
    mode: "receiving",
    department: "Client Success — The Escalation Chamber",
    villain: {
      name: "The Board of Dread",
      emoji: "🏛️",
      title: "Five Executives, Zero Patience",
      taunt: "The client is furious. Grovel, or fight. Pick one!",
    },
    setup:
      "A client's CFO emails: “Your AP automation rollout is a mess. Approvals are stuck, and you should go back to our old paper process.” You know approvals stalled because one approver wasn't set up, but returning to paper would undo months of progress.",
    prompt:
      "Write your reply to the CFO (2-4 sentences). Appreciate the feedback, then Accept or Decline: what will you act on, and what will you respectfully decline, and why?",
    placeholder: "Thank you for raising this... You're right that... I'd recommend we don't... because...",
    exemplar:
      "Thank you for flagging this so clearly; stuck approvals are a real problem and I'm glad you told us. You're right that the rollout missed something: one approver wasn't set up, and we'll fix that today and review every approval path with your team by Friday. I'd recommend we don't return to paper, because it would undo the time savings you've already gained, but if approvals aren't flowing by next week I'll set up a call to revisit.",
  },
  {
    id: "boss-g-handoff",
    kind: "boss",
    mode: "giving",
    department: "Project Management — The War Room",
    villain: {
      name: "The Micromanager Minotaur",
      emoji: "🐂",
      title: "Lord of the Labyrinth of Blame",
      taunt: "Just tell them they messed up. Loudly. In front of everyone!",
    },
    setup:
      "Priya, a new analyst, handed off a client file with no notes, and you spent an hour figuring out where things stood. She's eager and capable, but this is her third handoff without notes, and the client deadline is Monday.",
    prompt:
      "Write the feedback you'd give Priya (2-4 sentences). Make it Assist (helpful, not venting) and Actionable (clear, concrete next steps).",
    placeholder: "Hi Priya, I want to help your handoffs... Could you... I'm happy to...",
    exemplar:
      "Hi Priya, your work on the Henderson file was solid, and I want your handoffs to be just as strong. When I picked it up, I couldn't tell what was done, so it took me an hour to catch up. For your next handoff, could you add three lines at the top: what's finished, what's pending, and any client quirks? I'm happy to walk through one together on Thursday.",
  },
  {
    id: "boss-g-rooftop",
    kind: "boss",
    mode: "giving",
    department: "The Rooftop — Lair of the Doom Director",
    villain: {
      name: "The Doom Director",
      emoji: "🦹",
      title: "Ruler of 'Just Do Better'",
      taunt: "Feedback should be vague and angry. Prove me wrong, hero!",
    },
    setup:
      "Your peer Tom presented the quarterly close results to the leadership team. His numbers were right, but he read every slide word for word, skipped the cash-flow risk entirely, and ran 15 minutes over. He asks you for honest feedback.",
    prompt:
      "Write the feedback you'd give Tom (2-4 sentences). Make it Assist (helpful, not venting) and Actionable (clear, concrete next steps).",
    placeholder: "Thanks for asking, Tom. Your numbers were... Next time, could you... I can help by...",
    exemplar:
      "Thanks for asking, Tom; your numbers were airtight, and I want leadership to see that. Next time, could you open with the three key takeaways, including the cash-flow risk, and keep each slide to one talking point instead of reading it? Aim for 20 minutes, and I'm happy to do a timed run-through with you the day before.",
  },
];
