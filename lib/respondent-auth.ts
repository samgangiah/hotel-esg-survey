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
 * Server-only. Returns null if no valid session — caller decides whether to
 * redirect (page) or return 401 (API route).
 */
export async function getRespondent(): Promise<RespondentAuth | null> {
  const sessionId = await getRespondentSessionId();
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { respondent: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

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

/**
 * Page-friendly variant — redirects to / if no valid session.
 */
export async function requireRespondent(): Promise<RespondentAuth> {
  const me = await getRespondent();
  if (!me) redirect("/");
  return me;
}
