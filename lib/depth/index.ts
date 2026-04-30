import type { Question } from "@/lib/questions/types";

import { generateFollowUp } from "./followup";
import { runLayer3 } from "./judge";
import { runLayer1, runLayer2 } from "./layers";
import type {
  AssessAnswerInput,
  AssessmentResult,
  FollowUpResult,
} from "./types";

export type {
  AnswerResponse,
  AssessmentResult,
  FollowUpResult,
} from "./types";

export async function assessAnswer(
  input: AssessAnswerInput,
): Promise<AssessmentResult> {
  const { question, answer } = input;

  const l1 = runLayer1(answer, question);
  if (l1.verdict !== "ambiguous") {
    return {
      verdict: l1.verdict,
      layer: 1,
      reason: l1.reason,
      missingPiece:
        l1.verdict === "shallow"
          ? deriveShallowMissingPiece(answer, question)
          : undefined,
    };
  }

  const l2 = runLayer2(answer, question);
  if (l2.verdict !== "ambiguous") {
    return {
      verdict: l2.verdict,
      layer: 2,
      reason: l2.reason,
      missingPiece:
        l2.verdict === "shallow"
          ? deriveShallowMissingPiece(answer, question)
          : undefined,
    };
  }

  return runLayer3(question, answer);
}

function deriveShallowMissingPiece(_answer: string, question: Question): string {
  if (question.tradeoffExposed) {
    return "the alternative approaches considered before making this decision";
  }

  if (question.failureModeProbed) {
    return "what breaks or fails if this decision is wrong";
  }

  return "the specific reasoning behind the decision, not just what was done";
}

export async function assessAndFollowUp(
  input: AssessAnswerInput,
): Promise<{ assessment: AssessmentResult; followUp?: FollowUpResult }> {
  const assessment = await assessAnswer(input);

  if (assessment.verdict === "deep" || input.followUpCount >= 2) {
    return { assessment };
  }

  const followUp = await generateFollowUp(
    input.question,
    input.answer,
    assessment,
  );

  return { assessment, followUp };
}
