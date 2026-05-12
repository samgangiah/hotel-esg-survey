"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";

/**
 * Close (lock) a SurveyInstance — the Operator Admin's "we're done" button.
 *
 * After this, saveAnswer / submitSection / file uploads / file deletes are all
 * refused for that instance. The /survey runner still loads (read-only) so the
 * team can keep reviewing what they sent. Reversible via reopenInstance.
 *
 * Authorisation: must be the Operator Admin of the operator that owns the
 * instance's site.
 */
export async function closeInstance(
  instanceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  const instance = await db.surveyInstance.findUnique({
    where: { id: instanceId },
    include: { site: true },
  });
  if (!instance) return { ok: false, error: "Survey not found." };
  if (instance.site.operatorId !== me.operatorId) {
    return { ok: false, error: "Not your survey." };
  }
  if (instance.status === "submitted" || instance.status === "locked") {
    return { ok: false, error: "Survey is already closed." };
  }

  await db.surveyInstance.update({
    where: { id: instanceId },
    data: { status: "submitted", lockedAt: new Date() },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "instance.submitted",
    targetType: "SurveyInstance",
    targetId: instanceId,
    payload: { closedBy: "operator_admin", siteId: instance.siteId },
  });

  return { ok: true };
}

/**
 * Reopen a closed instance — undo for closeInstance. Useful when a respondent
 * realises they need to amend something after the operator admin has already
 * closed it.
 */
export async function reopenInstance(
  instanceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  const instance = await db.surveyInstance.findUnique({
    where: { id: instanceId },
    include: { site: true },
  });
  if (!instance) return { ok: false, error: "Survey not found." };
  if (instance.site.operatorId !== me.operatorId) {
    return { ok: false, error: "Not your survey." };
  }
  if (instance.status !== "submitted" && instance.status !== "locked") {
    return { ok: false, error: "Survey isn't closed." };
  }

  await db.surveyInstance.update({
    where: { id: instanceId },
    data: { status: "in_progress", lockedAt: null },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "instance.reopened",
    targetType: "SurveyInstance",
    targetId: instanceId,
    payload: { reopenedBy: "operator_admin", siteId: instance.siteId },
  });

  return { ok: true };
}
