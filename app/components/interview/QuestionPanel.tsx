import type { ReactNode } from "react";

import type { Question } from "@/lib/questions/types";

interface QuestionPanelProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  isFollowUp: boolean;
  followUpCount: number;
  displayedText?: string;
  voiceEnabled?: boolean;
  voiceSupported?: boolean;
  voiceMuted?: boolean;
  isSpeaking?: boolean;
  isClarifying?: boolean;
  voiceError?: string | null;
  onVoiceToggle?: () => void;
  onMuteToggle?: () => void;
  onReplay?: () => void;
  onStopSpeaking?: () => void;
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
  voiceEnabled = false,
  voiceSupported = false,
  voiceMuted = false,
  isSpeaking = false,
  isClarifying = false,
  voiceError,
  onVoiceToggle,
  onMuteToggle,
  onReplay,
  onStopSpeaking,
}: QuestionPanelProps) {
  const text = displayedText ?? question.text;

  return (
    <section className="question-panel">
      <div className="question-top-row">
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
        <div className="voice-controls" aria-label="Voice conversation controls">
          <button
            className={`ci-button voice-button${voiceEnabled ? " active" : ""}`}
            type="button"
            onClick={onVoiceToggle}
            title="Turn voice conversation on or off"
          >
            {voiceEnabled ? "voice on" : "voice off"}
          </button>
          {voiceEnabled ? (
            <>
              <button
                className="ci-button voice-button"
                type="button"
                disabled={!voiceSupported || isClarifying}
                onClick={onReplay}
                title="Replay the current question"
              >
                replay
              </button>
              <button
                className="ci-button voice-button"
                type="button"
                disabled={!voiceSupported || !isSpeaking}
                onClick={onStopSpeaking}
                title="Stop speaking"
              >
                stop
              </button>
              <button
                className={`ci-button voice-button${voiceMuted ? " active" : ""}`}
                type="button"
                disabled={!voiceSupported}
                onClick={onMuteToggle}
                title="Mute or unmute spoken questions"
              >
                {voiceMuted ? "unmute" : "mute"}
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className={`question-text${isFollowUp ? " followup" : ""}`}>
        {highlightArtifact(text, question.artifactReferenced)}
      </div>
      {voiceEnabled ? (
        <div className="voice-note">
          {isClarifying
            ? "clarifying the question..."
            : voiceError ??
              "Voice accuracy varies by browser. You can edit every transcript before submitting."}
        </div>
      ) : null}
    </section>
  );
}
