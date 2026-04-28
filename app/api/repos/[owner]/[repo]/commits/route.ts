import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getCommitDiff, getRecentCommits } from "@/lib/github";

export async function GET(
  request: Request,
  context: { params: Promise<{ owner: string; repo: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo } = await context.params;
  const repoFullName = `${owner}/${repo}`;
  const url = new URL(request.url);
  const sha = url.searchParams.get("sha");

  try {
    if (sha) {
      const diff = await getCommitDiff(session.accessToken, repoFullName, sha);

      return Response.json({ diff });
    }

    const commits = await getRecentCommits(session.accessToken, repoFullName, 5);

    return Response.json({ commits });
  } catch (error) {
    console.error("Failed to fetch GitHub commits", error);

    return Response.json(
      { error: "Unable to fetch GitHub commits." },
      { status: 502 },
    );
  }
}
