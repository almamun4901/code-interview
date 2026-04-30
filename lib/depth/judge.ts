import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "@/lib/questions/types";

import type { AssessmentResult } from "./types";

const JUDGE_MODEL = "claude-sonnet-4-5-20250929";

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

export async function runLayer3(
  question: Question,
  answer: string,
): Promise<AssessmentResult> {
  const prompt = `
You are evaluating a technical interview answer for depth and quality.

QUESTION ASKED:
"${question.text}"

CANDIDATE'S ANSWER:
"${answer}"

CONTEXT ON THIS QUESTION:
- This question was specifically about: ${question.artifactReferenced}
- A shallow answer looks like: ${question.shallowAnswerLooksLike}
- A deep answer looks like: ${question.deepAnswerLooksLike}

SCORING CRITERIA:
An answer is DEEP if it does at least TWO of these:
1. Names a specific trade-off or constraint that influenced the decision
2. Mentions at least one alternative considered (even briefly)
3. Describes a failure mode or edge case the decision accounts for
4. Gives a concrete reason - a number, measurement, or deadline

An answer is SHALLOW if it does ZERO or ONE of the above.
Long answers that just restate what the code does without explaining WHY are SHALLOW.
Confident-sounding answers that use generic reasoning ("best practice", "it scales better") without specifics are SHALLOW.

If SHALLOW, identify the single most important missing piece - this will be used to generate a targeted follow-up question.

Reply in EXACTLY this format, nothing else:
VERDICT: DEEP
REASON: One sentence explaining what made it deep.

or:

VERDICT: SHALLOW
REASON: One sentence explaining what the missing piece is.
MISSING: One phrase naming the specific thing absent (e.g. "the alternative they considered", "why this value specifically", "what breaks on cache miss")
`.trim();

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 150,
      system:
        "You evaluate technical interview answers for depth. You reply in the exact format specified, nothing else.",
      messages: [{ role: "user", content: prompt }],
    });

    return parseJudgeResponse(extractText(response));
  } catch (err) {
    console.warn(
      "[depth/judge] Layer 3 API error, defaulting to shallow:",
      err,
    );
    return {
      verdict: "shallow",
      layer: 3,
      reason: "Layer 3 unavailable - defaulting to shallow",
      missingPiece: "more detail about the reasoning behind this decision",
    };
  }
}

function parseJudgeResponse(raw: string): AssessmentResult {
  const verdictMatch = raw.match(/VERDICT:\s*(DEEP|SHALLOW)/i);
  const reasonMatch = raw.match(/REASON:\s*(.+)/i);
  const missingMatch = raw.match(/MISSING:\s*(.+)/i);

  const verdict = verdictMatch?.[1]?.toLowerCase() as
    | "deep"
    | "shallow"
    | undefined;
  const reason = reasonMatch?.[1]?.trim() ?? "No reason provided";
  const missingPiece = missingMatch?.[1]?.trim();

  if (!verdict) {
    console.warn("[depth/judge] Could not parse verdict from:", raw.slice(0, 200));
    return {
      verdict: "shallow",
      layer: 3,
      reason: "Could not parse judge response - defaulting to shallow",
      missingPiece: "more detail about the reasoning",
    };
  }

  return {
    verdict,
    layer: 3,
    reason,
    missingPiece:
      verdict === "shallow"
        ? (missingPiece ?? "more detail about the reasoning")
        : undefined,
  };
}
