import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getRespondentSessionId } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/safe-redirect";

export interface RespondentAuth {
  sessionId: string;
  respondentId: string;
  email: string;
  name: string;
  isOperatorAdmin: boolean;
}

/**
 * Build the /recover URL, carrying a `?next=` hop back to the page the
 * caller was trying to reach (read from the x-pathname header the
 * middleware sets). After the respondent recovers + signs in, /r/[token]
 * sends them straight there.
 */
export async function recoverUrl(): Promise<string> {
  try {
    const h = await headers();
    const next = safeNextPath(h.get("x-pathname"));
    if (next) return `/recover?next=${encodeURIComponent(next)}`;
  } catch {
    // headers() unavailable outside a request scope — fall through.
  }
  return "/recover";
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
 * Page-friendly variant — redirects to /recover if no valid session.
 *
 * /recover is the right landing for unauthenticated respondents because:
 *  - they HAD an invitation (otherwise they wouldn't be deep-linking here)
 *  - they can self-serve a fresh magic link to their email
 *  - sending them to the marketing landing instead just confuses them
 *
 * The flow becomes: click email link on a phone with no session → land on
 * /recover → enter email → get fresh link → click → land in survey. Much
 * better than dumping them on the marketing page with no path forward.
 */
export async function requireRespondent(): Promise<RespondentAuth> {
  const me = await getRespondent();
  if (!me) redirect(await recoverUrl());
  return me;
}
