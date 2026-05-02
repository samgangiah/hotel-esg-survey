"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendInvitationEmail } from "@/lib/mailer";
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
