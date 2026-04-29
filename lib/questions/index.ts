import { assembleCommitContext } from "./context";
import { callWithRetry } from "./retry";
import type { GenerationError, QuestionSet } from "./types";

export type { CommitContext, GenerationError, Question, QuestionSet } from "./types";

export type GenerateResult =
  | { ok: true; data: QuestionSet }
  | { ok: false; error: GenerationError };

export async function generateQuestions(
  token: string,
  repoFullName: string,
  sha: string,
): Promise<GenerateResult> {
  let ctx;
  try {
    ctx = await assembleCommitContext(token, repoFullName, sha);
  } catch (err) {
    return {
      ok: false,
      error: {
        type: "context_error",
        message:
          err instanceof Error ? err.message : "Failed to fetch commit context",
      },
    };
  }

  const result = await callWithRetry(ctx);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: result.data,
  };
}
