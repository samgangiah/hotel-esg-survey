/**
 * Event-triggered email helpers. Server-only — never imported into client
 * components. Lives outside `"use server"` files so it can be imported by
 * multiple action files without each call becoming a server action.
 *
 * Every helper here is best-effort: failures are caught by the caller and
 * never block the underlying database write. The Resend client itself
 * stubs out to console when RESEND_API_KEY is unset, so local dev "Just
 * Works" without spam risk.
 */

import { db } from "@/lib/db";
import {
  sendSurveyClosedEmail,
  sendSurveyReopenedEmail,
} from "@/lib/mailer";

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

/**
 * Email everyone with an assignment on this instance that it's been closed.
 * Skips the person who triggered the close (they obviously know) and anyone
 * whose email is flagged invalid by Resend bounce events.
 */
export async function notifyOnInstanceClosed(args: {
  instanceId: string;
  closedByName: string;
  closerRespondentId: string | null;
}): Promise<void> {
  const instance = await db.surveyInstance.findUnique({
    where: { id: args.instanceId },
    include: { site: true },
  });
  if (!instance) return;

  const recipients = await db.respondent.findMany({
    where: {
      assignments: { some: { surveyInstanceId: args.instanceId } },
      deletedAt: null,
      emailInvalid: false,
      ...(args.closerRespondentId
        ? { id: { not: args.closerRespondentId } }
        : {}),
    },
  });

  for (const r of recipients) {
    await sendSurveyClosedEmail({
      to: r.email,
      toName: r.name,
      siteName: instance.site.name,
      closedByName: args.closedByName,
      reviewUrl: `${appUrl()}/survey/${args.instanceId}/review`,
    });
  }
}

export async function notifyOnInstanceReopened(args: {
  instanceId: string;
  reopenedByName: string;
  reopenerRespondentId: string | null;
}): Promise<void> {
  const instance = await db.surveyInstance.findUnique({
    where: { id: args.instanceId },
    include: { site: true },
  });
  if (!instance) return;

  const recipients = await db.respondent.findMany({
    where: {
      assignments: { some: { surveyInstanceId: args.instanceId } },
      deletedAt: null,
      emailInvalid: false,
      ...(args.reopenerRespondentId
        ? { id: { not: args.reopenerRespondentId } }
        : {}),
    },
  });

  for (const r of recipients) {
    await sendSurveyReopenedEmail({
      to: r.email,
      toName: r.name,
      siteName: instance.site.name,
      reopenedByName: args.reopenedByName,
      surveyUrl: `${appUrl()}/survey/${args.instanceId}`,
    });
  }
}
