import Anthropic from "@anthropic-ai/sdk";

import { parseResponse, type ParseResult } from "./parse";
import { buildQuestionPrompt } from "./prompt";
import type { CommitContext, Question } from "./types";

const QUESTION_MODEL = "claude-sonnet-4-5-20250929";

function firstArtifact(ctx: CommitContext): string {
  return ctx.filePaths[0] ?? ctx.shortSha;
}

function buildFallbackQuestions(ctx: CommitContext): Question[] {
  const artifact = firstArtifact(ctx);

  return [
    {
      id: "q1",
      text: `Walk me through the main decision you made in commit ${ctx.commitSha} - what were you trying to solve?`,
      targetDepth: "deep",
      artifactReferenced: ctx.commitSha,
      tradeoffExposed: true,
      failureModeProbed: false,
      shallowAnswerLooksLike: "Describes what the code does without explaining why.",
      deepAnswerLooksLike:
        "Explains the problem that forced the change and why this approach over alternatives.",
    },
    {
      id: "q2",
      text: `You changed ${artifact} in this commit - what was the state of that file before, and what was wrong with it?`,
      targetDepth: "deep",
      artifactReferenced: artifact,
      tradeoffExposed: false,
      failureModeProbed: false,
      shallowAnswerLooksLike:
        "Describes the new implementation without characterizing the old one.",
      deepAnswerLooksLike:
        "Describes the specific problem with the old code that made this change necessary.",
    },
    {
      id: "q3",
      text: `What's the most likely thing to break from commit ${ctx.shortSha} if requirements change?`,
      targetDepth: "deep",
      artifactReferenced: ctx.shortSha,
      tradeoffExposed: false,
      failureModeProbed: true,
      shallowAnswerLooksLike: "Names a generic brittleness like hardcoded values or no tests.",
      deepAnswerLooksLike:
        "Names a specific assumption baked into the current design and what invalidates it.",
    },
  ];
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export async function callWithRetry(ctx: CommitContext): Promise<ParseResult> {
  const { system, user } = buildQuestionPrompt(ctx);

  let rawText: string;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: QUESTION_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    });
    rawText = extractText(response);
  } catch (err) {
    return {
      ok: false,
      error: {
        type: "api_error",
        message: err instanceof Error ? err.message : "Unknown API error",
      },
    };
  }

  const attempt1 = parseResponse(rawText, ctx.commitSha);
  if (attempt1.ok) {
    return attempt1;
  }

  console.warn("[question-gen] Attempt 1 failed:", attempt1.error.message);
  console.warn("[question-gen] Raw response:", attempt1.error.rawResponse);

  try {
    const client = new Anthropic();
    const response2 = await client.messages.create({
      model: QUESTION_MODEL,
      max_tokens: 1024,
      system,
      messages: [
        { role: "user", content: user },
        { role: "assistant", content: rawText },
        {
          role: "user",
          content: `Your response was invalid. Error: ${attempt1.error.message}. Return only the corrected JSON object, nothing else.`,
        },
      ],
    });
    const rawText2 = extractText(response2);

    const attempt2 = parseResponse(rawText2, ctx.commitSha);
    if (attempt2.ok) {
      return attempt2;
    }

    console.warn("[question-gen] Attempt 2 failed:", attempt2.error.message);
  } catch (err) {
    console.warn("[question-gen] Attempt 2 API error:", err);
  }

  console.warn("[question-gen] Both attempts failed. Using fallback questions.");
  return {
    ok: true,
    commitSha: ctx.commitSha,
    data: {
      questions: buildFallbackQuestions(ctx),
      commitSha: ctx.commitSha,
      generatedAt: new Date().toISOString(),
      promptVersion: "fallback",
    },
  };
}
