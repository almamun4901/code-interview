import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "@/lib/questions/types";

import type { AssessmentResult, FollowUpResult } from "./types";

const FOLLOWUP_MODEL = "claude-sonnet-4-5-20250929";

function buildFallbackFollowUp(
  candidateAnswer: string,
  assessment: AssessmentResult,
): string {
  const missing = assessment.missingPiece;
  const answerReference = extractAnswerReference(candidateAnswer);

  if (missing?.includes("alternative")) {
    return `${answerReference} - what other approaches did you consider before settling on this one?`;
  }
  if (
    missing?.includes("failure") ||
    missing?.includes("breaks") ||
    missing?.includes("edge")
  ) {
    return `${answerReference} - what's the failure mode you were most worried about there?`;
  }
  if (
    missing?.includes("why") ||
    missing?.includes("reason") ||
    missing?.includes("reasoning")
  ) {
    return `${answerReference} - what specific requirement made that the right call at the time?`;
  }
  return `${answerReference} - what would have to be different for you to make another choice here?`;
}

function extractAnswerReference(candidateAnswer: string): string {
  const trimmed = candidateAnswer.trim().replace(/\s+/g, " ");
  const numberMatch = trimmed.match(/\b\d+(?:\.\d+)?\s*(?:ms|seconds|minutes|hours|days|%|percent|x)?\b/i);
  if (numberMatch) {
    return `You mentioned ${numberMatch[0]}`;
  }

  const firstSentence = trimmed.split(/[.!?]/)[0] ?? trimmed;
  const words = firstSentence.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  if (words) {
    return `You said "${words}"`;
  }

  return "On that answer";
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

export async function generateFollowUp(
  question: Question,
  candidateAnswer: string,
  assessment: AssessmentResult,
): Promise<FollowUpResult> {
  const prompt = `
You are a senior engineer interviewing a candidate. They just gave a shallow answer.
Generate ONE follow-up question.

ORIGINAL QUESTION:
"${question.text}"

CANDIDATE'S ANSWER:
"${candidateAnswer}"

WHAT'S MISSING:
${assessment.missingPiece ?? assessment.reason}

RULES FOR THE FOLLOW-UP:
- It MUST reference something specific from the candidate's answer (show you listened)
- It MUST ask for exactly the missing piece - don't ask about something else
- It must NOT repeat the original question or be a restatement of it
- It must NOT contain the answer or hint at what the right answer is
- It must feel like a natural human follow-up, not a correction or a test
- It must be ONE sentence, ending with a question mark
- Maximum 30 words
- Conversational tone - as if spoken, not written

Bad follow-up: "Why did you make that choice?"
Good follow-up: "You said the controller felt convenient - what alternative layer did you consider before choosing it?"

Return ONLY the follow-up question. No explanation, no preamble.
`.trim();

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: FOLLOWUP_MODEL,
      max_tokens: 80,
      system:
        "You generate one follow-up interview question. You return only the question, nothing else.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = extractText(response).replace(/^["']|["']$/g, "");

    if (text.length < 10 || !text.includes("?")) {
      return {
        text: buildFallbackFollowUp(candidateAnswer, assessment),
        isFollowUp: true,
      };
    }

    return { text, isFollowUp: true };
  } catch {
    return {
      text: buildFallbackFollowUp(candidateAnswer, assessment),
      isFollowUp: true,
    };
  }
}
