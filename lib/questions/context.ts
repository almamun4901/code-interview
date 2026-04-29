import { Octokit } from "@octokit/rest";

import type { CommitContext } from "./types";

const MAX_DIFF_CHARS = 6000;

function splitRepo(repoFullName: string) {
  const [owner, repo] = repoFullName.split("/");

  if (!owner || !repo) {
    throw new Error("Repository must be in owner/name format.");
  }

  return { owner, repo };
}

function truncateDiffAtHunkBoundary(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) {
    return diff;
  }

  const preview = diff.slice(0, MAX_DIFF_CHARS);
  const lastHunkStart = preview.lastIndexOf("\n@@");
  const cutPoint = lastHunkStart > 0 ? lastHunkStart : preview.lastIndexOf("\n");
  const truncated = preview.slice(0, cutPoint > 0 ? cutPoint : MAX_DIFF_CHARS);

  return `${truncated}\n// [diff truncated - showing first ${MAX_DIFF_CHARS} chars of ${diff.length} total]`;
}

export async function assembleCommitContext(
  token: string,
  repoFullName: string,
  sha: string,
): Promise<CommitContext> {
  const { owner, repo } = splitRepo(repoFullName);
  const octokit = new Octokit({ auth: token });

  const [{ data: commit }, diffResponse, { data: repoData }] = await Promise.all([
    octokit.rest.repos.getCommit({ owner, repo, ref: sha }),
    octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
      owner,
      repo,
      ref: sha,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    }),
    octokit.rest.repos.get({ owner, repo }),
  ]);

  const rawDiff =
    typeof diffResponse.data === "string"
      ? diffResponse.data
      : JSON.stringify(diffResponse.data, null, 2);

  let parentCommitMessage: string | undefined;
  try {
    const parentSha = commit.parents?.[0]?.sha;

    if (parentSha) {
      const { data: parent } = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: parentSha,
      });
      parentCommitMessage = parent.commit.message;
    }
  } catch {
    // Parent context is helpful but not required for question generation.
  }

  let prDescription: string | undefined;
  try {
    const { data: prs } =
      await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: sha,
      });

    if (prs.length > 0) {
      prDescription = prs[0].body ?? undefined;
    }
  } catch {
    // PR context is best-effort only.
  }

  return {
    repoFullName,
    repoLanguage: repoData.language ?? "Unknown",
    commitSha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    commitMessage: commit.commit.message,
    commitDate:
      commit.commit.author?.date ??
      commit.commit.committer?.date ??
      new Date().toISOString(),
    diff: truncateDiffAtHunkBoundary(rawDiff),
    filePaths: commit.files?.map((file) => file.filename) ?? [],
    ...(prDescription ? { prDescription } : {}),
    ...(parentCommitMessage ? { parentCommitMessage } : {}),
  };
}
