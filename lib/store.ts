import type { Question } from "@/lib/questions/types";
import type { CommitContext } from "@/lib/questions/types";

import type { AssessmentResult } from "./depth";

export interface StoredAnswer {
  answer: string;
  assessment: AssessmentResult;
  timestamp: string;
}

export interface InterviewSession {
  id: string;
  questions: Question[];
  answers: Record<string, StoredAnswer>;
  followUpCounts: Record<string, number>;
  createdAt: string;
  completedAt?: string;
  repo?: string;
  sha?: string;
  context?: CommitContext;
}

type NewSessionData = Omit<
  InterviewSession,
  "id" | "answers" | "followUpCounts" | "createdAt"
> &
  Partial<
    Pick<InterviewSession, "answers" | "followUpCounts" | "createdAt">
  >;

const globalForSessions = globalThis as typeof globalThis & {
  __codeInterviewSessions?: Map<string, InterviewSession>;
};

const sessions =
  globalForSessions.__codeInterviewSessions ??
  new Map<string, InterviewSession>();

globalForSessions.__codeInterviewSessions = sessions;

export async function createSession(data: NewSessionData): Promise<string> {
  const id = crypto.randomUUID();
  sessions.set(id, {
    id,
    questions: data.questions,
    answers: data.answers ?? {},
    followUpCounts: data.followUpCounts ?? {},
    createdAt: data.createdAt ?? new Date().toISOString(),
    completedAt: data.completedAt,
    repo: data.repo,
    sha: data.sha,
    context: data.context,
  });

  return id;
}

export async function getSession(id: string): Promise<InterviewSession | null> {
  return sessions.get(id) ?? null;
}

export async function updateSession(
  id: string,
  patch: Partial<Omit<InterviewSession, "id">>,
): Promise<void> {
  const existing = sessions.get(id);
  if (!existing) {
    return;
  }

  sessions.set(id, { ...existing, ...patch });
}
