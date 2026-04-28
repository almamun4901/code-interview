"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import type { GitHubRepo } from "@/lib/github";

type RepoResponse = {
  repos?: GitHubRepo[];
  error?: string;
};

type CommitResponse = {
  commits?: Array<{
    sha: string;
    message: string;
    date: string | null;
    files_changed: string[];
  }>;
  diff?: string;
  error?: string;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [diffRepo, setDiffRepo] = useState<string | null>(null);

  const sortedRepos = useMemo(
    () =>
      [...repos].sort((a, b) => {
        const pushedA = a.pushed_at ? Date.parse(a.pushed_at) : 0;
        const pushedB = b.pushed_at ? Date.parse(b.pushed_at) : 0;

        return pushedB - pushedA;
      }),
    [repos],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let isMounted = true;

    async function loadRepos() {
      setIsLoadingRepos(true);
      setError(null);

      const response = await fetch("/api/repos");
      const data = (await response.json()) as RepoResponse;

      if (!isMounted) {
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Unable to load repositories.");
        setIsLoadingRepos(false);
        return;
      }

      setRepos(data.repos ?? []);
      setIsLoadingRepos(false);
    }

    void loadRepos();

    return () => {
      isMounted = false;
    };
  }, [status]);

  async function logLatestDiff(repoFullName: string) {
    setDiffRepo(repoFullName);
    setError(null);
    const encodedRepoPath = repoFullName
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    try {
      const commitsResponse = await fetch(
        `/api/repos/${encodedRepoPath}/commits`,
      );
      const commitsData = (await commitsResponse.json()) as CommitResponse;

      if (!commitsResponse.ok || !commitsData.commits?.[0]) {
        throw new Error(commitsData.error ?? "No recent commits found.");
      }

      const [latestCommit] = commitsData.commits;
      const diffResponse = await fetch(
        `/api/repos/${encodedRepoPath}/commits?sha=${encodeURIComponent(latestCommit.sha)}`,
      );
      const diffData = (await diffResponse.json()) as CommitResponse;

      if (!diffResponse.ok || !diffData.diff) {
        throw new Error(diffData.error ?? "No diff returned for commit.");
      }

      console.info("Latest commit diff", {
        repo: repoFullName,
        sha: latestCommit.sha,
        files: latestCommit.files_changed,
        diff: diffData.diff,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to log latest commit diff.",
      );
    } finally {
      setDiffRepo(null);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 text-zinc-700">
        Loading account...
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen bg-stone-50 px-6 py-10 text-zinc-950">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-4xl flex-col justify-center gap-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              CodeInterview
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
              Practice interviews grounded in your actual commits.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-700">
              Connect GitHub to list repositories and inspect recent commit
              diffs for the interview flow.
            </p>
          </div>
          <button
            className="w-fit rounded-md bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            type="button"
            onClick={() => void signIn("github")}
          >
            Sign in with GitHub
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 text-zinc-950 sm:px-6">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              CodeInterview
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              GitHub repositories
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Signed in as {session.user?.name ?? session.user?.email ?? "GitHub user"}
            </p>
          </div>
          <button
            className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-950"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600">
            {isLoadingRepos
              ? "Loading repositories..."
              : `${sortedRepos.length} repositories available`}
          </p>
        </div>

        <div className="grid gap-3">
          {sortedRepos.map((repo) => (
            <article
              className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm"
              key={repo.full_name}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {repo.full_name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {repo.description ?? "No description provided."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="rounded-md bg-zinc-100 px-2 py-1">
                      {repo.language ?? "Unknown language"}
                    </span>
                    <span className="rounded-md bg-zinc-100 px-2 py-1">
                      Pushed {repo.pushed_at ? new Date(repo.pushed_at).toLocaleDateString() : "unknown"}
                    </span>
                  </div>
                </div>
                <button
                  className="w-fit shrink-0 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  type="button"
                  disabled={diffRepo === repo.full_name}
                  onClick={() => void logLatestDiff(repo.full_name)}
                >
                  {diffRepo === repo.full_name ? "Logging diff..." : "Log latest diff"}
                </button>
              </div>
            </article>
          ))}
        </div>

        {!isLoadingRepos && sortedRepos.length === 0 ? (
          <div className="rounded-md border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600">
            No repositories returned for this GitHub account.
          </div>
        ) : null}
      </section>
    </main>
  );
}
