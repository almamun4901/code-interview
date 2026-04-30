import { assessAnswer } from "../lib/depth";
import type { Question } from "../lib/questions/types";

const sampleQuestion: Question = {
  id: "q1",
  text: "You're caching in `api/users.js` at the controller layer - was that a deliberate architectural boundary decision, or did you put it where it was convenient?",
  targetDepth: "deep",
  artifactReferenced: "api/users.js",
  tradeoffExposed: true,
  failureModeProbed: false,
  shallowAnswerLooksLike:
    "Says they cached at the controller because it was easy or made sense, without addressing the layer choice.",
  deepAnswerLooksLike:
    "Explains why the controller layer specifically - either as an architectural boundary, or acknowledges it was a shortcut and explains what they'd do differently.",
};

const testCases = [
  {
    label: "CLEAR SHALLOW - one sentence, no reasoning",
    answer: "I put the cache there because it seemed like the right place.",
    expectedVerdict: "shallow",
  },
  {
    label: "SHALLOW - longer but still no trade-off",
    answer:
      "Caching at the controller layer is a common pattern. It's the entry point for requests so it made sense to cache there. It worked well for our use case and improved performance significantly. The cache hit rate has been good in production.",
    expectedVerdict: "shallow",
  },
  {
    label: "AMBIGUOUS - some signals but vague",
    answer:
      "I considered putting it in the service layer but went with the controller instead. It was easier to implement there and the team understood it better.",
    expectedVerdict: "shallow",
  },
  {
    label: "CLEAR DEEP - trade-off + failure mode",
    answer:
      "Deliberate, actually. We had a rule that the service layer should be cache-agnostic so we could swap caching strategies without touching business logic. The controller was the right boundary because it owns the HTTP context - we cache the full serialized response, not the domain object, which meant we didn't have to think about partial invalidation. The downside is that two controller actions that touch the same data have separate cache keys, but that was acceptable given our invalidation requirements.",
    expectedVerdict: "deep",
  },
  {
    label: "DEEP - concrete numbers and alternatives",
    answer:
      "We put it at the controller layer after profiling showed the serialization step was taking 40ms on every request. I looked at caching at the service layer but that would have required changing 6 different call sites. The controller was a single choke point. We're aware that this means we cache the rendered JSON, not the model, so cache invalidation is coarser - we flush the whole key on any user update rather than selectively.",
    expectedVerdict: "deep",
  },
  {
    label: "TRICKY - long answer that restates the code",
    answer:
      "The caching logic in api/users.js checks if the user data is in the cache first. If it is, it returns the cached value. If not, it fetches from the database and stores the result in the cache for next time. This reduces the number of database queries significantly. The TTL is set to 5 minutes which means the cache refreshes regularly. It works well and has reduced our database load.",
    expectedVerdict: "shallow",
  },
] as const;

async function runTests() {
  console.log("\nDepth Detection Test Suite");
  console.log("=".repeat(60));

  let passed = 0;
  let failed = 0;
  let layer3Count = 0;

  for (const testCase of testCases) {
    const result = await assessAnswer({
      question: sampleQuestion,
      answer: testCase.answer,
      followUpCount: 0,
    });

    if (result.layer === 3) {
      layer3Count++;
    }

    const pass = result.verdict === testCase.expectedVerdict;
    if (pass) {
      passed++;
    } else {
      failed++;
    }

    const icon = pass ? "PASS" : "FAIL";
    console.log(`\n${icon} ${testCase.label}`);
    console.log(
      `  Expected: ${testCase.expectedVerdict} | Got: ${result.verdict} [Layer ${result.layer}]`,
    );
    console.log(`  Reason: ${result.reason}`);
    if (!pass) {
      console.log(`  MISMATCH - answer preview: "${testCase.answer.slice(0, 80)}..."`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed}/${testCases.length} passed, ${failed} failed`);
  console.log(`Layer 3 fired on ${layer3Count}/${testCases.length} cases`);

  if (failed > 0) {
    console.log("\nFailing cases need attention before shipping.");
  }
}

runTests().catch(console.error);
