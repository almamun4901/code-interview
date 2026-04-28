import { Octokit } from "@octokit/rest";

export type GitHubRepo = {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  pushed_at: string | null;
};

export type GitHubCommit = {
  sha: string;
  message: string;
  date: string | null;
  files_changed: string[];
};

function createOctokit(token: string) {
  return new Octokit({
    auth: token,
  });
}

function splitRepo(repo: string) {
  const [owner, name] = repo.split("/");

  if (!owner || !name) {
    throw new Error("Repository must be in owner/name format.");
  }

  return { owner, repo: name };
}

export async function getUserRepos(token: string): Promise<GitHubRepo[]> {
  const octokit = createOctokit(token);

  const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: "owner,collaborator,organization_member",
    per_page: 100,
    sort: "pushed",
    direction: "desc",
  });

  return repos.map((repo) => ({
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    language: repo.language,
    pushed_at: repo.pushed_at,
  }));
}

export async function getRecentCommits(
  token: string,
  repo: string,
  limit = 20,
): Promise<GitHubCommit[]> {
  const octokit = createOctokit(token);
  const params = splitRepo(repo);
  const { data: commits } = await octokit.rest.repos.listCommits({
    ...params,
    per_page: limit,
  });

  return Promise.all(
    commits.slice(0, limit).map(async (commit) => {
      const { data: detail } = await octokit.rest.repos.getCommit({
        ...params,
        ref: commit.sha,
      });

      return {
        sha: commit.sha,
        message: commit.commit.message,
        date: commit.commit.author?.date ?? commit.commit.committer?.date ?? null,
        files_changed: detail.files?.map((file) => file.filename) ?? [],
      };
    }),
  );
}

export async function getCommitDiff(
  token: string,
  repo: string,
  sha: string,
): Promise<string> {
  const octokit = createOctokit(token);
  const params = splitRepo(repo);
  const response = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
    ...params,
    ref: sha,
    headers: {
      accept: "application/vnd.github.v3.diff",
    },
  });

  const diff =
    typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data, null, 2);

  return diff.slice(0, 6000);
}

export async function getPRDescription(
  token: string,
  repo: string,
  sha: string,
): Promise<string | null> {
  const octokit = createOctokit(token);
  const params = splitRepo(repo);

  try {
    const { data: pulls } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
      {
        ...params,
        commit_sha: sha,
        headers: {
          accept: "application/vnd.github+json",
        },
      },
    );

    const firstPull = Array.isArray(pulls) ? pulls[0] : undefined;

    return firstPull?.body ?? null;
  } catch (error) {
    console.warn("Unable to fetch associated pull request", error);
    return null;
  }
}
