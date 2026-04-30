"use client";

import { useMemo, useState } from "react";

interface AnswerPanelProps {
  onSubmit: (answer: string) => void;
  isLoading: boolean;
  disabled: boolean;
  error?: string | null;
}

export function AnswerPanel({
  onSubmit,
  isLoading,
  disabled,
  error,
}: AnswerPanelProps) {
  const [answer, setAnswer] = useState("");
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
