import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { assessAndFollowUp } from "@/lib/depth";
import { getSession, updateSession } from "@/lib/store";

function readStringField(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const sessionId = readStringField(body, "sessionId");
  const questionId = readStringField(body, "questionId");
  const answer = readStringField(body, "answer");

  if (!sessionId || !questionId || !answer) {
    return Response.json(
      { error: "Missing required fields: sessionId, questionId, answer" },
      { status: 400 },
    );
  }

  const interviewSession = await getSession(sessionId);
  if (!interviewSession) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const currentQuestion = interviewSession.questions.find(
    (question) => question.id === questionId,
  );
  if (!currentQuestion) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  const followUpCount = interviewSession.followUpCounts[questionId] ?? 0;
  const { assessment, followUp } = await assessAndFollowUp({
    question: currentQuestion,
    answer,
    followUpCount,
  });

  await updateSession(sessionId, {
    answers: {
      ...interviewSession.answers,
      [`${questionId}_${followUpCount}`]: {
        answer,
        assessment,
        timestamp: new Date().toISOString(),
      },
    },
    followUpCounts: {
      ...interviewSession.followUpCounts,
      [questionId]: followUpCount + (followUp ? 1 : 0),
    },
  });

  if (followUp) {
    return Response.json({ followUp, assessment });
  }

  const currentIndex = interviewSession.questions.findIndex(
    (question) => question.id === questionId,
  );
  const nextQuestion = interviewSession.questions[currentIndex + 1];

  if (!nextQuestion) {
    await updateSession(sessionId, { completedAt: new Date().toISOString() });
    return Response.json({ sessionComplete: true, assessment });
  }

  return Response.json({ next: nextQuestion, assessment });
}
