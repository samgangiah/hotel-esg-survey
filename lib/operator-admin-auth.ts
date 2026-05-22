import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getRespondentSessionId } from "@/lib/auth/session";
import { recoverUrl } from "@/lib/respondent-auth";

export interface OperatorAdminAuth {
  sessionId: string;
  respondentId: string;
  email: string;
  name: string;
  operatorId: string;
  operatorName: string;
}

/**
 * Resolve the active Respondent and require that they are an Operator Admin
 * (`isOperatorAdmin === true`). Server-only. Used by all `/operator/*` pages
 * except the magic-link landing.
 *
 * Redirects to /recover if there is no valid respondent session (so the
 * operator admin can self-serve a fresh magic link when deep-linking from an
 * email on a phone with no session). Redirects to /survey if the respondent
 * is not an Operator Admin (their portal is the survey itself).
 */
export async function requireOperatorAdmin(): Promise<OperatorAdminAuth> {
  const sessionId = await getRespondentSessionId();
  if (!sessionId) redirect(await recoverUrl());

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      respondent: { include: { operator: true } },
    },
  });
  if (!session || session.expiresAt < new Date()) redirect(await recoverUrl());

  if (!session.respondent.isOperatorAdmin) {
    redirect("/survey");
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
    operatorId: session.respondent.operator.id,
    operatorName: session.respondent.operator.name,
  };
}
