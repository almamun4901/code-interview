"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { AnswerPanel } from "@/app/components/interview/AnswerPanel";
import {
  DiffSidebar,
  type DiffFile,
} from "@/app/components/interview/DiffSidebar";
import {
  EndScreen,
  type SessionAnswer,
} from "@/app/components/interview/EndScreen";
import { Header } from "@/app/components/interview/Header";
import { QuestionPanel } from "@/app/components/interview/QuestionPanel";
import type { Question } from "@/lib/questions/types";
import type { InterviewSession } from "@/lib/store";

interface InterviewClientProps {
  sessionId: string;
}

interface AnswerResponse {
  followUp?: { text: string; isFollowUp: true };
  next?: Question;
  sessionComplete?: boolean;
  assessment: {
    verdict: "deep" | "shallow";
    layer: 1 | 2 | 3;
    reason: string;
    missingPiece?: string;
  };
  error?: string;
}

interface InterviewState {
  currentQuestionIndex: number;
  currentQuestion: Question | null;
  isFollowUp: boolean;
  followUpCount: number;
  isLoading: boolean;
  isComplete: boolean;
  sidebarCollapsed: boolean;
  activeFile: string;
  answers: SessionAnswer[];
  followUpsFired: number;
}

type VoiceCommand = "repeat" | "clarify";

interface ClarifyResponse {
  text?: string;
  error?: string;
}

function parseDiffFiles(diff: string, filePaths: string[]): DiffFile[] {
  const sections = diff.split(/\ndiff --git /);
  const files = sections
    .map((section, index) => (index === 0 ? section : `diff --git ${section}`))
    .filter((section) => section.trim().length > 0)
    .map((section) => {
      const header = section.split("\n")[0] ?? "";
      const match = header.match(/ b\/(.+)$/);
      const fallback = filePaths.find((path) => section.includes(path));
      const path = match?.[1] ?? fallback ?? "unknown";
      const lines = section.split("\n");
      const additions = lines.filter(
        (line) => line.startsWith("+") && !line.startsWith("+++"),
      ).length;
      const deletions = lines.filter(
        (line) => line.startsWith("-") && !line.startsWith("---"),
      ).length;

      return { path, diff: section, additions, deletions };
    });

  if (files.length > 0) {
    return files;
  }

  return filePaths.map((path) => ({
    path,
    diff,
    additions: diff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    deletions: diff
      .split("\n")
      .filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
  }));
}

function matchFileToQuestion(question: Question, files: DiffFile[]): string {
  const referenced = files.find(
    (file) =>
      file.path.includes(question.artifactReferenced) ||
      question.artifactReferenced.includes(file.path),
  );
  return referenced?.path ?? files[0]?.path ?? "";
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useTypedText(text: string, speed = 18, enabled = true): string {
  const [typed, setTyped] = useState({ source: "", displayed: "" });

  useEffect(() => {
    if (!text || !enabled) return;

    let i = 0;
    const interval = setInterval(() => {
      setTyped({ source: text, displayed: text.slice(0, i + 1) });
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [enabled, speed, text]);

  if (!enabled) return text;
  return typed.source === text ? typed.displayed : "";
}

export function InterviewClient({ sessionId }: InterviewClientProps) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [clarifiedQuestion, setClarifiedQuestion] = useState<string | null>(null);
  const [isClarifying, setIsClarifying] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const speechTokenRef = useRef(0);
  const [state, setState] = useState<InterviewState>({
    currentQuestionIndex: 0,
    currentQuestion: null,
    isFollowUp: false,
    followUpCount: 0,
    isLoading: false,
    isComplete: false,
    sidebarCollapsed: false,
    activeFile: "",
    answers: [],
    followUpsFired: 0,
  });

  const files = useMemo(
    () => parseDiffFiles(session?.context?.diff ?? "", session?.context?.filePaths ?? []),
    [session],
  );
  const prefersReduced = usePrefersReducedMotion();
  const displayedQuestion = useTypedText(
    clarifiedQuestion ?? state.currentQuestion?.text ?? "",
    18,
    !prefersReduced,
  );
  const speechSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const stopSpeaking = useCallback(() => {
    if (!speechSupported) {
      return;
    }

    speechTokenRef.current += 1;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [speechSupported]);

  const speakQuestion = useCallback(
    (text: string) => {
      if (!speechSupported || voiceMuted || !text.trim()) {
        return;
      }

      speechTokenRef.current += 1;
      const token = speechTokenRef.current;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => {
        if (speechTokenRef.current === token) {
          setIsSpeaking(true);
        }
      };
      utterance.onend = () => {
        if (speechTokenRef.current === token) {
          setIsSpeaking(false);
        }
      };
      utterance.onerror = () => {
        if (speechTokenRef.current === token) {
          setIsSpeaking(false);
          setVoiceError("Spoken questions are unavailable right now. The text is still shown.");
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [speechSupported, voiceMuted],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      setLoadError(null);
      const response = await fetch(`/api/interview/session/${sessionId}`);
      const data = (await response.json()) as InterviewSession & { error?: string };

      if (!isMounted) return;

      if (!response.ok) {
        setLoadError(
          response.status === 404
            ? "Session not found or expired."
            : data.error ?? "Unable to load session.",
        );
        return;
      }

      const parsedFiles = parseDiffFiles(data.context?.diff ?? "", data.context?.filePaths ?? []);
      const firstQuestion = data.questions[0] ?? null;
      const restoredAnswers: SessionAnswer[] = Object.entries(data.answers ?? {}).map(
        ([key, answer]) => {
          const questionId = key.split("_")[0];
          const question =
            data.questions.find((item) => item.id === questionId) ??
            data.questions[0];
          return { key, question, answer };
        },
      );

      setSession(data);
      setClarifiedQuestion(null);
      setState((current) => ({
        ...current,
        currentQuestion: firstQuestion,
        activeFile: firstQuestion ? matchFileToQuestion(firstQuestion, parsedFiles) : "",
        isComplete: Boolean(data.completedAt),
        answers: restoredAnswers,
        followUpsFired: Object.values(data.followUpCounts ?? {}).reduce(
          (total, count) => total + count,
          0,
        ),
      }));
    }

    const timer = window.setTimeout(() => void loadSession(), 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!voiceEnabled || voiceMuted || !state.currentQuestion) {
      return;
    }

    if (!speechSupported) {
      return;
    }

    speakQuestion(clarifiedQuestion ?? state.currentQuestion.text);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [
    clarifiedQuestion,
    speakQuestion,
    speechSupported,
    state.currentQuestion,
    voiceEnabled,
    voiceMuted,
  ]);

  const handleSubmit = useCallback(
    async (answer: string) => {
      if (!state.currentQuestion || !session) return;

      const submittedQuestion = state.currentQuestion;
      const submittedFollowUpCount = state.followUpCount;
      setState((current) => ({ ...current, isLoading: true }));
      setAnswerError(null);

      try {
        const response = await fetch("/api/interview/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: submittedQuestion.id,
            answer,
          }),
        });
        const data = (await response.json()) as AnswerResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Something went wrong");
        }

        const storedAnswer: SessionAnswer = {
          key: `${submittedQuestion.id}_${submittedFollowUpCount}`,
          question: submittedQuestion,
          answer: {
            answer,
            assessment: data.assessment,
            timestamp: new Date().toISOString(),
          },
        };

        if (data.followUp || data.next) {
          setClarifiedQuestion(null);
        }

        setState((current) => {
          const answers = [...current.answers, storedAnswer];

          if (data.followUp && current.currentQuestion) {
            return {
              ...current,
              currentQuestion: {
                ...current.currentQuestion,
                text: data.followUp.text,
              },
              isFollowUp: true,
              followUpCount: current.followUpCount + 1,
              isLoading: false,
              answers,
              followUpsFired: current.followUpsFired + 1,
            };
          }

          if (data.next) {
            return {
              ...current,
              currentQuestionIndex: current.currentQuestionIndex + 1,
              currentQuestion: data.next,
              isFollowUp: false,
              followUpCount: 0,
              activeFile: matchFileToQuestion(data.next, files),
              isLoading: false,
              answers,
            };
          }

          if (data.sessionComplete) {
            return {
              ...current,
              isComplete: true,
              isLoading: false,
              answers,
            };
          }

          return { ...current, isLoading: false, answers };
        });
        setResetKey((key) => key + 1);
      } catch {
        setAnswerError("Something went wrong — try submitting again.");
        setState((current) => ({ ...current, isLoading: false }));
      }
    },
    [files, session, sessionId, state.currentQuestion, state.followUpCount],
  );

  const handleVoiceToggle = useCallback(() => {
    setVoiceEnabled((enabled) => {
      const next = !enabled;
      if (!next) {
        stopSpeaking();
      } else if (!speechSupported) {
        setVoiceError("Spoken questions are not supported in this browser.");
      }
      return next;
    });
  }, [speechSupported, stopSpeaking]);

  const handleReplay = useCallback(() => {
    if (!state.currentQuestion) {
      return;
    }

    if (!speechSupported) {
      setVoiceError("Spoken questions are not supported in this browser.");
      return;
    }

    setVoiceError(null);
    speakQuestion(clarifiedQuestion ?? state.currentQuestion.text);
  }, [clarifiedQuestion, speakQuestion, speechSupported, state.currentQuestion]);

  const handleVoiceCommand = useCallback(
    async (command: VoiceCommand, transcript: string) => {
      if (!state.currentQuestion) {
        return;
      }

      if (command === "repeat") {
        handleReplay();
        return;
      }

      setIsClarifying(true);
      setVoiceError(null);

      try {
        const response = await fetch("/api/interview/clarify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionId: state.currentQuestion.id,
            currentText: clarifiedQuestion ?? state.currentQuestion.text,
            userCommand: transcript,
          }),
        });
        const data = (await response.json()) as ClarifyResponse;

        if (!response.ok || !data.text) {
          throw new Error(data.error ?? "Unable to clarify");
        }

        setClarifiedQuestion(data.text);
      } catch {
        setVoiceError("I couldn't clarify that question. Try replaying it or keep answering in your own words.");
      } finally {
        setIsClarifying(false);
      }
    },
    [
      clarifiedQuestion,
      handleReplay,
      sessionId,
      state.currentQuestion,
    ],
  );

  if (loadError) {
    return (
      <main className="state-page">
        <section className="state-card">
          <p className="ci-error">{loadError}</p>
          <Link className="ci-button ci-button-primary" href="/">
            Back to repos
          </Link>
        </section>
      </main>
    );
  }

  if (!session || !state.currentQuestion) {
    return (
      <main className="state-page">
        <section className="state-card">Loading session...</section>
      </main>
    );
  }

  const context = session.context;
  const repoFullName = context?.repoFullName ?? session.repo ?? "unknown/repo";
  const commitSha = context?.commitSha ?? session.sha ?? "";
  const shortSha = context?.shortSha ?? commitSha.slice(0, 7);
  const commitMessage = context?.commitMessage ?? "Commit interview";

  if (state.isComplete) {
    return (
      <EndScreen
        repoFullName={repoFullName}
        shortSha={shortSha}
        commitMessage={commitMessage}
        questionCount={session.questions.length}
        deepCount={
          state.answers.filter((item) => item.answer.assessment.verdict === "deep")
            .length
        }
        followUpsFired={state.followUpsFired}
        answers={state.answers}
      />
    );
  }

  return (
    <div className="interview-shell">
      <Header
        repoFullName={repoFullName}
        commitSha={commitSha}
        shortSha={shortSha}
        commitMessage={commitMessage}
        currentQuestion={state.currentQuestionIndex + 1}
        totalQuestions={session.questions.length}
      />
      <div className="interview-main">
        <DiffSidebar
          files={files}
          activeFile={state.activeFile}
          referencedFile={state.currentQuestion.artifactReferenced}
          onFileSelect={(path) =>
            setState((current) => ({ ...current, activeFile: path }))
          }
          collapsed={state.sidebarCollapsed}
          onToggle={() =>
            setState((current) => ({
              ...current,
              sidebarCollapsed: !current.sidebarCollapsed,
            }))
          }
        />
        <div className="interview-content">
          <QuestionPanel
            question={state.currentQuestion}
            questionIndex={state.currentQuestionIndex}
            totalQuestions={session.questions.length}
            isFollowUp={state.isFollowUp}
            followUpCount={state.followUpCount}
            displayedText={displayedQuestion}
            voiceEnabled={voiceEnabled}
            voiceSupported={speechSupported}
            voiceMuted={voiceMuted}
            isSpeaking={isSpeaking}
            isClarifying={isClarifying}
            voiceError={voiceError}
            onVoiceToggle={handleVoiceToggle}
            onMuteToggle={() => {
              setVoiceMuted((muted) => {
                const next = !muted;
                if (next) {
                  stopSpeaking();
                }
                return next;
              });
            }}
            onReplay={handleReplay}
            onStopSpeaking={stopSpeaking}
          />
          <AnswerPanel
            key={resetKey}
            onSubmit={handleSubmit}
            isLoading={state.isLoading}
            disabled={state.isLoading}
            error={answerError}
            voiceEnabled={voiceEnabled}
            onVoiceCommand={handleVoiceCommand}
          />
        </div>
      </div>
    </div>
  );
}
