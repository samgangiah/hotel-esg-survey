import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getRespondentSessionId } from "@/lib/auth/session";

export interface RespondentAuth {
  sessionId: string;
  respondentId: string;
  email: string;
  name: string;
  isOperatorAdmin: boolean;
}

/**
 * Resolve the active respondent from the signed cookie + DB session.
 * Server-only. Redirects to / if no valid session.
 */
export async function requireRespondent(): Promise<RespondentAuth> {
  const sessionId = await getRespondentSessionId();
  if (!sessionId) redirect("/");

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { respondent: true },
  });
  if (!session || session.expiresAt < new Date()) {
    redirect("/");
  }

  await db.session.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });

  return {
    sessionId,
    respondentId: session.respondent.id,
    email: session.respondent.email,
    name: session.respondent.name,
    isOperatorAdmin: session.respondent.isOperatorAdmin,
  };
}
