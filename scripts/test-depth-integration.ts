import { assessAndFollowUp } from "../lib/depth";
import type { Question } from "../lib/questions/types";

const question: Question = {
  id: "q1",
  text: "Your `config/redis.js` sets TTL to 86400 - why that value specifically, and what breaks if it's wrong by a factor of 10?",
  targetDepth: "deep",
  artifactReferenced: "config/redis.js",
  tradeoffExposed: false,
  failureModeProbed: true,
  shallowAnswerLooksLike:
    "Says 86400 is 24 hours and it seemed reasonable, without addressing the failure mode.",
  deepAnswerLooksLike:
    "Explains why 24 hours matches a specific business requirement and what goes wrong at 8640 or 864000.",
};

async function runIntegration() {
  console.log("\nIntegration Test: Full Follow-Up Loop");
  console.log("=".repeat(60));

  console.log("\nRound 1: Shallow answer");
  const r1 = await assessAndFollowUp({
    question,
    answer:
      "86400 seconds is 24 hours. We set it to that because it's a reasonable TTL for our use case.",
    followUpCount: 0,
  });
  console.log(`Verdict: ${r1.assessment.verdict} [Layer ${r1.assessment.layer}]`);
  console.log(`Reason: ${r1.assessment.reason}`);
  if (r1.followUp) {
    console.log(`Follow-up generated: "${r1.followUp.text}"`);
  } else {
    console.log("No follow-up generated - expected one here");
  }

  console.log("\nRound 2: Deep answer");
  const r2 = await assessAndFollowUp({
    question,
    answer:
      "86400 is 24 hours, which maps to our session length - users expect their preferences to persist across a working day without a re-fetch. We actually started at 3600 (1 hour) but that was causing cache thrash during peak hours. At 10x longer (864000 seconds, about 10 days), we'd serve stale user preferences for users who updated their settings, which would be a support headache. At 10x shorter (8640 seconds, about 2.4 hours), we'd hit the DB roughly 10x more often, which at our peak request volume would push us past our DB connection limit.",
    followUpCount: 0,
  });
  console.log(`Verdict: ${r2.assessment.verdict} [Layer ${r2.assessment.layer}]`);
  console.log(`Reason: ${r2.assessment.reason}`);
  if (r2.followUp) {
    console.log("Follow-up generated - should not have been for a deep answer");
  } else {
    console.log("No follow-up - correct for deep answer");
  }

  console.log("\nRound 3: Shallow answer but follow-up limit reached");
  const r3 = await assessAndFollowUp({
    question,
    answer: "It just seemed like a good value for a day's worth of caching.",
    followUpCount: 2,
  });
  console.log(`Verdict: ${r3.assessment.verdict} [Layer ${r3.assessment.layer}]`);
  if (r3.followUp) {
    console.log("Follow-up generated - should not have been (limit reached)");
  } else {
    console.log("No follow-up - correct (follow-up limit enforced)");
  }
}

runIntegration().catch(console.error);
