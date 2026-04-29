import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { generateQuestions } from "@/lib/questions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const repo =
    typeof body === "object" &&
    body !== null &&
    "repo" in body &&
    typeof body.repo === "string"
      ? body.repo
      : undefined;
  const sha =
    typeof body === "object" &&
    body !== null &&
    "sha" in body &&
    typeof body.sha === "string"
      ? body.sha
      : undefined;

  if (!repo || !sha) {
    return Response.json(
      { error: "Missing required fields: repo, sha" },
      { status: 400 },
    );
  }

  const result = await generateQuestions(session.accessToken, repo, sha);

  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }

  return Response.json(result.data);
}
