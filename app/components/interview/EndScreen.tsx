"use client";

import Link from "next/link";

import type { Question } from "@/lib/questions/types";
import type { StoredAnswer } from "@/lib/store";

export interface SessionAnswer {
  key: string;
  question: Question;
  answer: StoredAnswer;
}

interface EndScreenProps {
  repoFullName: string;
  shortSha: string;
  commitMessage: string;
  questionCount: number;
  deepCount: number;
  followUpsFired: number;
  answers: SessionAnswer[];
}

export function EndScreen({
  repoFullName,
  shortSha,
  commitMessage,
  questionCount,
  deepCount,
  followUpsFired,
  answers,
}: EndScreenProps) {
  async function copySessionUrl() {
    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <main className="end-page">
      <div className="end-wrap">
        <header className="result-header">
          <svg className="check-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20 6 9 17l-5-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <div>
            <h1>Session complete</h1>
            <div className="home-subtle">
              {repoFullName} · {shortSha} · {commitMessage}
            </div>
            <div className="home-subtle">{new Date().toLocaleString()}</div>
          </div>
        </header>

        <section className="stats-row">
          <div className="metric-card">
            <div className="metric-number">{questionCount}</div>
            <div className="metric-label">Questions answered</div>
          </div>
          <div className="metric-card">
            <div className="metric-number">{deepCount}</div>
            <div className="metric-label">Deep answers</div>
          </div>
          <div className="metric-card">
            <div className="metric-number">{followUpsFired}</div>
            <div className="metric-label">Follow-ups triggered</div>
          </div>
        </section>

        <section className="answer-review" aria-label="Answer review">
          {answers.map(({ key, question, answer }, index) => (
            <details className="review-item" key={key}>
              <summary>
                <span className="review-question">
                  {index + 1}. {question.text}
                </span>
                <span className={`verdict-badge ${answer.assessment.verdict}`}>
                  {answer.assessment.verdict}
                </span>
              </summary>
              <div className="review-answer">{answer.answer}</div>
            </details>
          ))}
        </section>

        <div className="end-actions">
          <Link className="ci-button ci-button-primary" href="/">
            Start another session
          </Link>
          <button className="ci-button" type="button" onClick={copySessionUrl}>
            Copy session URL
          </button>
        </div>
      </div>
    </main>
  );
}
