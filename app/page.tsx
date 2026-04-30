"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

import { CommitList } from "@/app/components/home/CommitList";
import { RepoList } from "@/app/components/home/RepoList";
import type { GitHubRepo } from "@/lib/github";

export default function Home() {
  const { data: session, status } = useSession();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  if (status === "loading") {
    return (
      <main className="state-page">
        <section className="state-card">Loading account...</section>
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="state-page">
        <section className="state-card">
          <div className="app-logo">
            code<span>&gt;</span>interview
          </div>
          <h1 className="home-title">GitHub interview practice</h1>
          <p className="home-subtle">
            Sign in to choose a repository and start from a real commit.
          </p>
          <button
            className="ci-button ci-button-primary"
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
    <main className="home-page">
      <div className="home-wrap">
        <header className="home-header">
          <div>
            <div className="app-logo">
              code<span>&gt;</span>interview
            </div>
            <h1 className="home-title">Select a commit</h1>
            <div className="home-subtle">
              Signed in as {session.user?.name ?? session.user?.email ?? "GitHub user"}
            </div>
          </div>
          <button className="ci-button" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </header>

        <div className="home-grid">
          <RepoList
            selectedRepo={selectedRepo?.full_name ?? null}
            onSelect={setSelectedRepo}
          />
          <CommitList repoFullName={selectedRepo?.full_name ?? null} />
        </div>
      </div>
    </main>
  );
}
