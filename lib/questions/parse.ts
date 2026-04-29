import { z } from "zod";

import { PROMPT_VERSION } from "./prompt";
import type { GenerationError, Question, QuestionSet } from "./types";

const QuestionSchema = z.object({
  id: z.string().regex(/^q\d+$/),
  text: z.string().min(20).endsWith("?"),
  targetDepth: z.enum(["surface", "deep"]),
  artifactReferenced: z.string().min(1),
  tradeoffExposed: z.boolean(),
  failureModeProbed: z.boolean(),
  shallowAnswerLooksLike: z.string().min(10),
  deepAnswerLooksLike: z.string().min(10),
});

const ResponseSchema = z.object({
  questions: z.array(QuestionSchema).min(3).max(5),
});

function validateCrossConstraints(questions: Question[]): string | null {
  const hasTradeoff = questions.some((question) => question.tradeoffExposed);
  const hasFailureMode = questions.some((question) => question.failureModeProbed);

  if (!hasTradeoff) {
    return "No question exposes a trade-off (tradeoffExposed must be true on at least one)";
  }

  if (!hasFailureMode) {
    return "No question probes a failure mode (failureModeProbed must be true on at least one)";
  }

  const artifacts = questions.map((question) => question.artifactReferenced);
  const duplicates = artifacts.filter(
    (artifact, index) => artifacts.indexOf(artifact) !== index,
  );

  if (duplicates.length > 0) {
    return `Duplicate artifact referenced: ${duplicates[0]}`;
  }

  const missingVerbatimArtifact = questions.find(
    (question) => !question.text.includes(question.artifactReferenced),
  );

  if (missingVerbatimArtifact) {
    return `Question ${missingVerbatimArtifact.id} does not mention artifactReferenced verbatim`;
  }

  return null;
}

export type ParseResult =
  | { ok: true; data: QuestionSet; commitSha: string }
  | { ok: false; error: GenerationError };

export function parseResponse(rawText: string, commitSha: string): ParseResult {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: {
        type: "parse_failure",
        message: "Response was not valid JSON",
        rawResponse: rawText.slice(0, 500),
      },
    };
  }

  const result = ResponseSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: {
        type: "validation_failure",
        message: result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
        rawResponse: rawText.slice(0, 500),
      },
    };
  }

  const questions = result.data.questions as Question[];
  const crossError = validateCrossConstraints(questions);
  if (crossError) {
    return {
      ok: false,
      error: {
        type: "validation_failure",
        message: crossError,
        rawResponse: rawText.slice(0, 500),
      },
    };
  }

  return {
    ok: true,
    commitSha,
    data: {
      questions,
      commitSha,
      generatedAt: new Date().toISOString(),
      promptVersion: PROMPT_VERSION,
    },
  };
}
