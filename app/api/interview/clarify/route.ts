import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSession } from "@/lib/store";

const CLARIFY_MODEL = "claude-sonnet-4-5-20250929";

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function fallbackClarification(currentText: string): string {
  return `Let me ask that another way: ${currentText}`;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const sessionId = readStringField(body, "sessionId");
  const questionId = readStringField(body, "questionId");
  const currentText = readStringField(body, "currentText");
  const userCommand = readStringField(body, "userCommand");

  if (!sessionId || !questionId || !currentText || !userCommand) {
    return Response.json(
      {
        error:
          "Missing required fields: sessionId, questionId, currentText, userCommand",
      },
      { status: 400 },
    );
  }

  const interviewSession = await getSession(sessionId);
  if (!interviewSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const question = interviewSession.questions.find(
    (item) => item.id === questionId,
  );
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  const prompt = `
You are a senior engineer interviewing a candidate by voice.
The candidate asked for clarification, repetition, or explanation.

ORIGINAL QUESTION:
"${question.text}"

CURRENT DISPLAYED QUESTION:
"${currentText}"

USER SAID:
"${userCommand}"

QUESTION CONTEXT:
- Artifact referenced: ${question.artifactReferenced}
- Target depth: ${question.targetDepth}
- A shallow answer sounds like: ${question.shallowAnswerLooksLike}
- A strong answer sounds like: ${question.deepAnswerLooksLike}

Rewrite the current question so it is easier to understand when spoken aloud.
Rules:
- Ask only one question.
- Keep the same intent and artifact reference.
- Do not reveal the expected answer, trade-off, failure mode, or hints.
- Use a natural interviewer tone.
- Maximum 55 words.
- End with a question mark.

Return only the rewritten question.
`.trim();

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: CLARIFY_MODEL,
      max_tokens: 120,
      system:
        "You clarify technical interview questions. Return only the rewritten question.",
      messages: [{ role: "user", content: prompt }],
    });
    const text = extractText(response).replace(/^["']|["']$/g, "");

    if (text.length < 10 || !text.includes("?")) {
      return Response.json({ text: fallbackClarification(currentText) });
    }

    return Response.json({ text });
  } catch (err) {
    console.warn("[interview/clarify] API error, using fallback:", err);
    return Response.json({ text: fallbackClarification(currentText) });
  }
}
