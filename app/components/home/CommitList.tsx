"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Commit {
  sha: string;
  message: string;
  date: string | null;
  files_changed: string[];
}

interface CommitListProps {
  repoFullName: string | null;
}

interface CommitResponse {
  commits?: Commit[];
  error?: string;
}

interface StartResponse {
  sessionId?: string;
  error?: string;
}

function encodeRepoPath(repoFullName: string) {
  return repoFullName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "unknown date";
}

export function CommitList({ repoFullName }: CommitListProps) {
  const router = useRouter();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSha, setLoadingSha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCommits(repo: string) {
    setIsLoading(true);
    setError(null);
    setCommits([]);

    try {
      const response = await fetch(`/api/repos/${encodeRepoPath(repo)}/commits`);
      const data = (await response.json()) as CommitResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Couldn't load commits.");
      }

      setCommits(data.commits ?? []);
    } catch {
      setError("Couldn't load commits. Check your GitHub connection.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!repoFullName) return;
    const timer = window.setTimeout(() => void loadCommits(repoFullName), 0);
    return () => window.clearTimeout(timer);
  }, [repoFullName]);

  async function startInterview(commit: Commit) {
    if (!repoFullName) return;
    setLoadingSha(commit.sha);
    setError(null);

    try {
      const response = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoFullName, sha: commit.sha }),
      });
      const data = (await response.json()) as StartResponse;

      if (!response.ok || !data.sessionId) {
        throw new Error(data.error ?? "Unable to start interview.");
      }

      router.push(`/interview/${data.sessionId}`);
    } catch {
      setError("Couldn't start the interview. Try that commit again.");
      setLoadingSha(null);
    }
  }

  return (
    <section className="home-panel">
      <div className="home-panel-header">
        <span className="panel-label">commits</span>
        <span className="home-subtle">
          {repoFullName ? repoFullName : "select a repository"}
        </span>
      </div>
      {error ? (
        <div className="empty-state">
          <p className="ci-error">{error}</p>
          {repoFullName ? (
            <button
              className="ci-button"
              type="button"
              onClick={() => void loadCommits(repoFullName)}
            >
              retry
            </button>
          ) : null}
        </div>
      ) : null}
      {!repoFullName ? (
        <div className="empty-state">Choose a repo to inspect recent commits.</div>
      ) : null}
      {repoFullName && isLoading ? (
        <div className="empty-state">Loading commits...</div>
      ) : null}
      {!error && !isLoading
        ? commits.map((commit) => (
            <button
              className="list-row"
              key={commit.sha}
              type="button"
              disabled={Boolean(loadingSha)}
              onClick={() => void startInterview(commit)}
            >
              <span className="sha-badge">{commit.sha.slice(0, 7)}</span>
              <span className="list-main">
                <span className="list-title">{truncate(commit.message, 70)}</span>
                <span className="list-meta">
                  {formatDate(commit.date)} · {commit.files_changed.length} files
                </span>
              </span>
              {loadingSha === commit.sha ? (
                <span className="language-badge">starting...</span>
              ) : null}
            </button>
          ))
        : null}
      {!error && repoFullName && !isLoading && commits.length === 0 ? (
        <div className="empty-state">No recent commits returned.</div>
      ) : null}
    </section>
  );
}
