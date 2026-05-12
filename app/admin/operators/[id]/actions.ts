"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendInvitationEmail } from "@/lib/mailer";
import {
  notifyOnInstanceClosed,
  notifyOnInstanceReopened,
} from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/admin-auth";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function resendInvitation(
  assignmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      respondent: true,
      surveyInstance: { include: { site: true } },
      invitations: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  // Expire all existing invitations for this assignment.
  await db.invitation.updateMany({
    where: { assignmentId, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date(0), boundSessionId: null },
  });

  // Issue a new invitation.
  const { token, hash } = newToken();
  await db.invitation.create({
    data: {
      assignmentId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/r/${token}`;
  await sendInvitationEmail({
    to: assignment.respondent.email,
    toName: assignment.respondent.name,
    magicLink,
    siteName: assignment.surveyInstance.site.name,
    inviterName: me.name,
    roleLabel: assignment.respondent.isOperatorAdmin
      ? "Operator Admin (full survey access)"
      : `${assignment.role} · ${assignment.sectionId}`,
  });

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "invitation.resent",
    targetType: "Assignment",
    targetId: assignmentId,
    payload: { respondentEmail: assignment.respondent.email },
  });

  return { ok: true };
}

/**
 * Platform-admin override: close (lock) a SurveyInstance regardless of which
 * operator owns it. Mirrors `/operator` closeInstance but bypasses the
 * Operator-Admin gate — used when the operator is unresponsive but the
 * survey window has expired.
 */
export async function adminCloseInstance(
  instanceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();

  const instance = await db.surveyInstance.findUnique({
    where: { id: instanceId },
  });
  if (!instance) return { ok: false, error: "Survey not found." };
  if (instance.status === "submitted" || instance.status === "locked") {
    return { ok: false, error: "Survey is already closed." };
  }

  await db.surveyInstance.update({
    where: { id: instanceId },
    data: { status: "submitted", lockedAt: new Date() },
  });

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "instance.submitted",
    targetType: "SurveyInstance",
    targetId: instanceId,
    payload: { closedBy: "platform_admin", siteId: instance.siteId },
  });

  try {
    await notifyOnInstanceClosed({
      instanceId,
      closedByName: `${me.name} (Platform Admin)`,
      closerRespondentId: null, // not a respondent — notify everyone
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[notifyOnInstanceClosed]", e);
  }

  return { ok: true };
}

export async function adminReopenInstance(
  instanceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();

  const instance = await db.surveyInstance.findUnique({
    where: { id: instanceId },
  });
  if (!instance) return { ok: false, error: "Survey not found." };
  if (instance.status !== "submitted" && instance.status !== "locked") {
    return { ok: false, error: "Survey isn't closed." };
  }

  await db.surveyInstance.update({
    where: { id: instanceId },
    data: { status: "in_progress", lockedAt: null },
  });

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "instance.reopened",
    targetType: "SurveyInstance",
    targetId: instanceId,
    payload: { reopenedBy: "platform_admin", siteId: instance.siteId },
  });

  try {
    await notifyOnInstanceReopened({
      instanceId,
      reopenedByName: `${me.name} (Platform Admin)`,
      reopenerRespondentId: null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[notifyOnInstanceReopened]", e);
  }

  return { ok: true };
}
