// Regression probes for the deterministic heuristic judge.
// Run: node --test src/lib/judge/heuristic.test.ts   (Node 23+ strips TypeScript types natively)
import assert from "node:assert/strict";
import { test } from "node:test";

import type { heuristicJudge as HeuristicJudge } from "./heuristic";

// Explicit .ts URL so plain Node can resolve it without a bundler or tsx.
const { heuristicJudge } = (await import(new URL("./heuristic.ts", import.meta.url).href)) as {
  heuristicJudge: typeof HeuristicJudge;
};

const receiving = (answer: string) => heuristicJudge({ mode: "receiving", answer });
const giving = (answer: string) => heuristicJudge({ mode: "giving", answer });

const R_CLIENT_EXEMPLAR =
  "Thank you for flagging this so clearly; stuck approvals are a real problem and I'm glad you told us. You're right that the rollout missed something: one approver wasn't set up, and we'll fix that today and review every approval path with your team by Friday. I'd recommend we don't return to paper, because it would undo the time savings you've already gained, but if approvals aren't flowing by next week I'll set up a call to revisit.";
const R_REVIEW_EXEMPLAR =
  "Thank you for being direct with me; I'd rather hear it now than lose a client's attention. You're right that my presentations run long, so I'll cap them at 20 minutes and move the detail into an appendix. I'm going to keep more than five slides for complex audits, because clients need the reconciliation walkthrough, but I'll trim everything else and check in with you after the next one.";
const G_HANDOFF_EXEMPLAR =
  "Hi Priya, your work on the Henderson file was solid, and I want your handoffs to be just as strong. When I picked it up, I couldn't tell what was done, so it took me an hour to catch up. For your next handoff, could you add three lines at the top: what's finished, what's pending, and any client quirks? I'm happy to walk through one together on Thursday.";
const G_ROOFTOP_EXEMPLAR =
  "Thanks for asking, Tom; your numbers were airtight, and I want leadership to see that. Next time, could you open with the three key takeaways, including the cash-flow risk, and keep each slide to one talking point instead of reading it? Aim for 20 minutes, and I'm happy to do a timed run-through with you the day before.";

test("receiving: reasoned declines and team voice pass", () => {
  const probes = [
    "Thank you. I think five slides is too few for audits, so I'll keep my current length but trim the intro.",
    "Thank you. I think five slides is too few for audits, so I’ll keep my current length but trim the intro.",
    "Thank you so much for raising this with us, we really appreciate it. We'll fix the approver setup today. Going back to paper would undo months of progress, so let's keep the automation.",
    R_CLIENT_EXEMPLAR,
    R_REVIEW_EXEMPLAR,
  ];
  for (const answer of probes) {
    const r = receiving(answer);
    assert.equal(r.passed, true, `${JSON.stringify(r.scores)} :: ${answer}`);
  }
});

test("receiving: blind, dismissive and contemptuous answers fail", () => {
  for (const answer of [
    "whatever you say, I'll change everything",
    "nope, not changing",
    "Thank you for the feedback. I will ignore it because I don't care what you think.",
    "Thanks for the feedback, I'll keep doing it my way since I know best.",
  ]) {
    const r = receiving(answer);
    assert.equal(r.passed, false, `${JSON.stringify(r.scores)} :: ${answer}`);
  }
  assert.deepEqual(
    receiving("Thank you for the feedback. I will ignore it because I don't care what you think.").scores,
    { appreciate: 0, acceptOrDecline: 0 },
  );
});

test("giving: kind, concrete feedback passes", () => {
  const cases: [string, number, number][] = [
    ["Hi Priya, I'm always happy to help. Could you add a three-line summary at the top of each handoff by Monday? We can do one together.", 2, 2],
    ["Priya, I'd love it if handoffs never left the next person guessing. Could you add a short status note at the top of each file by 5pm on Friday?", 1, 2],
    ["Tom, your numbers were spot on. Next time, summarize each slide instead of reading it, lead with the cash-flow risk, and keep it to 20 minutes. Want to rehearse Thursday?", 2, 2],
  ];
  for (const [answer, assist, actionable] of cases) {
    const r = giving(answer);
    assert.equal(r.passed, true, `${JSON.stringify(r.scores)} :: ${answer}`);
    assert.deepEqual(r.scores, { assist, actionable }, answer);
  }
  for (const answer of [G_HANDOFF_EXEMPLAR, G_ROOFTOP_EXEMPLAR]) {
    assert.equal(giving(answer).passed, true, `${JSON.stringify(giving(answer).scores)} :: ${answer}`);
  }
});

test("giving: accusations, insults and keyword salad do not earn full marks", () => {
  assert.equal(giving("You always miss deadlines and never listen.").scores.assist, 0);
  const insult = giving("You were lazy and sloppy on this. Thanks, I want to help you improve. Next time, could you add notes by Friday?");
  assert.equal(insult.scores.assist, 0);
  assert.equal(insult.passed, false);
  const salad = giving("Great job, thanks! Let's help the team grow. Please try to plan and review going forward.");
  assert.equal(salad.scores.actionable, 1);
});
