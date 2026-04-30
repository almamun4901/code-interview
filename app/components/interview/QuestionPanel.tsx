import type { ReactNode } from "react";

import type { Question } from "@/lib/questions/types";

interface QuestionPanelProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  isFollowUp: boolean;
  followUpCount: number;
  displayedText?: string;
}

function highlightArtifact(text: string, artifact: string): ReactNode {
  if (!artifact || !text.includes(artifact)) {
    return text;
  }

  const parts = text.split(artifact);
  return parts.flatMap((part, i) => [
    part,
    i < parts.length - 1 ? (
      <code className="artifact-code" key={`${artifact}-${i}`}>
        {artifact}
      </code>
    ) : null,
  ]);
}

export function QuestionPanel({
  question,
  questionIndex,
  totalQuestions,
  isFollowUp,
  followUpCount,
  displayedText,
}: QuestionPanelProps) {
  const text = displayedText ?? question.text;

  return (
    <section className="question-panel">
      <div className="question-meta-row">
        <span className="question-meta">
          question {questionIndex + 1} of {totalQuestions}
        </span>
        <span className="depth-badge">{question.targetDepth}</span>
        {isFollowUp ? (
          <span className="followup-badge" title={`Follow-up ${followUpCount}`}>
            <span className="followup-dot" />
            follow-up
          </span>
        ) : null}
      </div>
      <div className={`question-text${isFollowUp ? " followup" : ""}`}>
        {highlightArtifact(text, question.artifactReferenced)}
      </div>
    </section>
  );
}
