"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type VoiceCommand = "repeat" | "clarify";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface AnswerPanelProps {
  onSubmit: (answer: string) => void;
  isLoading: boolean;
  disabled: boolean;
  error?: string | null;
  voiceEnabled?: boolean;
  onVoiceCommand?: (command: VoiceCommand, transcript: string) => void;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function normalizeVoicePhrase(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectVoiceCommand(transcript: string): VoiceCommand | null {
  const phrase = normalizeVoicePhrase(transcript);
  if (!phrase) {
    return null;
  }

  const repeatPatterns = [
    /\brepeat\b.*\bquestion\b/,
    /\bcan you repeat\b/,
    /\bsay that again\b/,
    /\bone more time\b/,
    /\bwhat was the question\b/,
  ];
  const clarifyPatterns = [
    /\bclarify\b.*\bquestion\b/,
    /\bi didn't understand\b/,
    /\bi did not understand\b/,
    /\bi don't understand\b/,
    /\bi do not understand\b/,
    /\bcan you explain\b/,
    /\bexplain that\b/,
  ];

  if (clarifyPatterns.some((pattern) => pattern.test(phrase))) {
    return "clarify";
  }

  if (repeatPatterns.some((pattern) => pattern.test(phrase))) {
    return "repeat";
  }

  return null;
}

function joinTranscript(current: string, next: string): string {
  const trimmedNext = next.trim();
  if (!trimmedNext) {
    return current;
  }

  const trimmedCurrent = current.trim();
  if (!trimmedCurrent) {
    return trimmedNext;
  }

  return `${trimmedCurrent} ${trimmedNext}`;
}

export function AnswerPanel({
  onSubmit,
  isLoading,
  disabled,
  error,
  voiceEnabled = false,
  onVoiceCommand,
}: AnswerPanelProps) {
  const [answer, setAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechRecognition = useMemo(
    () => getSpeechRecognitionConstructor(),
    [],
  );
  const recognitionSupported = Boolean(speechRecognition);
  const wordCount = useMemo(
    () => (answer.trim() === "" ? 0 : answer.trim().split(/\s+/).length),
    [answer],
  );
  const wordClass =
    wordCount < 30 ? "short" : wordCount < 80 ? "medium" : "long";

  function handleSubmit() {
    if (isLoading || disabled || answer.trim().length < 5) {
      return;
    }

    onSubmit(answer);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript("");
  }

  function startListening() {
    if (!speechRecognition || isLoading || disabled) {
      return;
    }

    setVoiceError(null);
    setInterimTranscript("");

    const recognition = new speechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interim = "";
      const finalParts: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (!transcript.trim()) {
          continue;
        }

        if (result.isFinal) {
          finalParts.push(transcript);
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim.trim());
      }

      for (const finalPart of finalParts) {
        const command = detectVoiceCommand(finalPart);
        if (command) {
          setInterimTranscript("");
          onVoiceCommand?.(command, finalPart);
          continue;
        }

        setAnswer((current) => joinTranscript(current, finalPart));
        setInterimTranscript("");
      }
    };
    recognition.onerror = (event) => {
      const permissionErrors = new Set(["not-allowed", "service-not-allowed"]);
      setVoiceError(
        permissionErrors.has(event.error ?? "")
          ? "Microphone permission was blocked. You can still type your answer."
          : "Speech recognition stopped unexpectedly. You can keep typing or try again.",
      );
      setIsListening(false);
      setInterimTranscript("");
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setVoiceError("Speech recognition could not start. You can still type your answer.");
      setIsListening(false);
    }
  }

  useEffect(() => {
    if (!voiceEnabled) {
      recognitionRef.current?.stop();
    }

    return () => {
      recognitionRef.current?.stop();
    };
  }, [voiceEnabled]);

  return (
    <section className="answer-panel">
      <label className="panel-label" htmlFor="answer">
        your answer
      </label>
      <textarea
        id="answer"
        value={answer}
        disabled={disabled}
        placeholder="Type your answer here. Take your time — this is not timed."
        onChange={(event) => setAnswer(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            handleSubmit();
          }
        }}
      />
      {voiceEnabled ? (
        <div className="voice-answer-bar">
          <button
            className={`ci-button voice-button${isListening ? " active" : ""}`}
            type="button"
            disabled={!recognitionSupported || isLoading || disabled}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? "stop listening" : "start listening"}
          </button>
          <span className="voice-transcript">
            {!recognitionSupported
              ? "Speech recognition is not supported in this browser."
              : interimTranscript
                ? `heard: ${interimTranscript}`
                : isListening
                  ? "listening..."
                  : "Speak naturally, then review the transcript before submitting."}
          </span>
        </div>
      ) : null}
      {voiceEnabled && voiceError ? (
        <div className="ci-error">{voiceError}</div>
      ) : null}
      {error ? <div className="ci-error">{error}</div> : null}
      <div className="answer-footer">
        <span className={`word-count ${wordClass}`}>{wordCount} words</span>
        <div className="answer-actions">
          <span className="answer-hint">shift+enter for new line</span>
          <button
            className="ci-button ci-button-primary submit-button"
            type="button"
            disabled={isLoading || disabled || answer.trim().length < 5}
            onClick={handleSubmit}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                assessing...
              </>
            ) : (
              "submit answer →"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
