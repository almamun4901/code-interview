import type { CommitContext } from "./types";

export const PROMPT_VERSION = "v1.0";

export function buildQuestionPrompt(ctx: CommitContext): {
  system: string;
  user: string;
} {
  const system =
    "You are a senior staff engineer conducting a technical interview. You have read the candidate's commit and you ask about the decisions they made. You return only valid JSON. You never add explanation, preamble, or markdown fences.";

  const user = `
You are interviewing a candidate about a specific commit they wrote.
Your job is to generate interview questions about the DECISIONS in this commit.

## Commit Context

Repository: ${ctx.repoFullName} (${ctx.repoLanguage})
Commit: ${ctx.shortSha} - "${ctx.commitMessage}"
Date: ${ctx.commitDate}
Files changed: ${ctx.filePaths.join(", ")}
${ctx.parentCommitMessage ? `\nParent commit: "${ctx.parentCommitMessage}"` : ""}
${ctx.prDescription ? `\nPR description: ${ctx.prDescription}` : ""}

## Diff

\`\`\`
${ctx.diff}
\`\`\`

---

## Rules

Follow every rule. A question that violates any rule must not appear in the output.

**Rule 1 - Artifact anchor (required on every question)**
Every question must reference at least one real artifact from the diff above.
Artifacts: a specific file name, function name, variable name, config value, line
number, or the commit SHA. A question with no artifact reference is disqualified.

**Rule 2 - Decision focus, not concept focus**
Ask about a CHOICE the candidate made, not a concept they should know.
Failing: "How does caching work?"
Passing: "You're caching in \`${ctx.filePaths[0] ?? ctx.shortSha}\` at the controller layer - was
that a deliberate boundary decision, or did you put it where it was convenient?"
Test: if a textbook answer fully satisfies the question, rewrite it.

**Rule 3 - At least one trade-off question**
One question must make it clear there was another reasonable approach and ask why
this one was chosen. Do not name the alternative - let the candidate name it.

**Rule 4 - At least one failure mode question**
One question must probe what happens when something goes wrong.
Find a place in the diff where the happy path is handled but an edge case or failure
mode is ambiguous. Ask about it without signaling that it's a concern.

**Rule 5 - Defensibility gap**
The question must be structured so that a one-sentence answer is obviously incomplete.
"I used Redis because it's fast" should feel like a non-answer to the question you asked.

**Rule 6 - Do not give away the answer**
The question must not contain the reasoning the candidate should supply.
Failing: "Since you chose Redis for its sub-millisecond latency, how did that affect..."
Passing: "You introduced Redis here - what drove that choice over the existing store?"

**Rule 7 - No duplicate file coverage**
Ask at most one question about the same file or function. Spread across the diff.
If you have already asked about \`api/users.js\`, do not ask another question about \`api/users.js\`.

**Rule 8 - Quantity**
Generate between 3 and 5 questions. Never fewer than 3, never more than 5.

---

## Output Format

Return ONLY this JSON structure. No other text.

{
  "questions": [
    {
      "id": "q1",
      "text": "The question, written as spoken by an interviewer. Conversational. One or two sentences.",
      "targetDepth": "deep",
      "artifactReferenced": "The specific artifact this question anchors to.",
      "tradeoffExposed": true,
      "failureModeProbed": false,
      "shallowAnswerLooksLike": "One sentence: what a plausible but incomplete answer sounds like.",
      "deepAnswerLooksLike": "One sentence: what a complete, defensible answer sounds like."
    }
  ]
}

Constraints on the JSON:
- "targetDepth" must be exactly "surface" or "deep"
- "tradeoffExposed" and "failureModeProbed" are booleans
- Across all questions: at least one tradeoffExposed === true
- Across all questions: at least one failureModeProbed === true
- "text" must be a question (end with ?)
- "artifactReferenced" must be a non-empty string
- The artifact in "artifactReferenced" must appear verbatim in "text"
`.trim();

  return { system, user };
}
