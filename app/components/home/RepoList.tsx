"use client";

import { useEffect, useMemo, useState } from "react";

import type { GitHubRepo } from "@/lib/github";

interface RepoListProps {
  selectedRepo: string | null;
  onSelect: (repo: GitHubRepo) => void;
}

interface RepoResponse {
  repos?: GitHubRepo[];
  error?: string;
}

function daysAgo(value: string | null) {
  if (!value) return "unknown";
  const diff = Date.now() - Date.parse(value);
  const days = Math.max(0, Math.floor(diff / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function RepoList({ selectedRepo, onSelect }: RepoListProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedRepos = useMemo(
    () =>
      [...repos].sort((a, b) => {
        const pushedA = a.pushed_at ? Date.parse(a.pushed_at) : 0;
        const pushedB = b.pushed_at ? Date.parse(b.pushed_at) : 0;
        return pushedB - pushedA;
      }),
    [repos],
  );

  async function loadRepos() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/repos");
      const data = (await response.json()) as RepoResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Couldn't load repos.");
      }

      setRepos(data.repos ?? []);
    } catch {
      setError("Couldn't load repos. Check your GitHub connection.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRepos(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="home-panel">
      <div className="home-panel-header">
        <span className="panel-label">repositories</span>
        <span className="home-subtle">
          {isLoading ? "Loading..." : `${sortedRepos.length} available`}
        </span>
      </div>
      {error ? (
        <div className="empty-state">
          <p className="ci-error">{error}</p>
          <button className="ci-button" type="button" onClick={() => void loadRepos()}>
            retry
          </button>
        </div>
      ) : null}
      {!error && sortedRepos.length > 0
        ? sortedRepos.map((repo) => (
            <button
              className={`list-row${
                selectedRepo === repo.full_name ? " active" : ""
              }`}
              key={repo.full_name}
              type="button"
              onClick={() => onSelect(repo)}
            >
              <span className="list-main">
                <span className="list-title">{repo.full_name}</span>
                <span className="list-meta">last pushed {daysAgo(repo.pushed_at)}</span>
              </span>
              <span className="language-badge">{repo.language ?? "unknown"}</span>
            </button>
          ))
        : null}
      {!error && !isLoading && sortedRepos.length === 0 ? (
        <div className="empty-state">No repositories returned for this account.</div>
      ) : null}
    </section>
  );
}
