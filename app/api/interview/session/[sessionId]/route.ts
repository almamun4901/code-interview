import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSession } from "@/lib/store";

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const authSession = await getServerSession(authOptions);
  if (!authSession) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await getSession(sessionId);

  if (!session) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(session);
}
