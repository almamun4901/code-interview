import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getUserRepos } from "@/lib/github";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await getUserRepos(session.accessToken);

    return Response.json({ repos });
  } catch (error) {
    console.error("Failed to fetch GitHub repositories", error);

    return Response.json(
      { error: "Unable to fetch GitHub repositories." },
      { status: 502 },
    );
  }
}
