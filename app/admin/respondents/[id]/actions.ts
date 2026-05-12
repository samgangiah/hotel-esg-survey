"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/admin-auth";

/**
 * GDPR right-to-erasure (soft-delete).
 *
 * Sets Respondent.deletedAt + expires every session and active invitation
 * for that respondent. Answers, files, and audit rows are LEFT in place
 * (intentional — they're attributed to the respondent, but they also form
 * part of the operator's survey record. Pure data deletion is a follow-up
 * operation when the operator agrees to release the answers too).
 *
 * Reversible via undeleteRespondent (clears deletedAt) — but expired
 * sessions and invitations stay expired.
 */
export async function softDeleteRespondent(
  respondentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();
  const now = new Date();
  const epoch = new Date(0);

  const r = await db.respondent.findUnique({ where: { id: respondentId } });
  if (!r) return { ok: false, error: "Respondent not found." };
  if (r.deletedAt) return { ok: false, error: "Already deleted." };

  await db.$transaction([
    db.respondent.update({
      where: { id: respondentId },
      data: { deletedAt: now },
    }),
    // Expire active sessions so the respondent is signed out everywhere.
    db.session.updateMany({
      where: { respondentId, expiresAt: { gt: now } },
      data: { expiresAt: epoch },
    }),
    // Expire active invitations on every assignment owned by this respondent.
    db.invitation.updateMany({
      where: {
        expiresAt: { gt: now },
        assignment: { respondentId },
      },
      data: { expiresAt: epoch, boundSessionId: null },
    }),
  ]);

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "respondent.softDeleted",
    targetType: "Respondent",
    targetId: respondentId,
    payload: { email: r.email, operatorId: r.operatorId },
  });

  return { ok: true };
}

export async function undeleteRespondent(
  respondentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();
  const r = await db.respondent.findUnique({ where: { id: respondentId } });
  if (!r) return { ok: false, error: "Respondent not found." };
  if (!r.deletedAt) return { ok: false, error: "Respondent isn't deleted." };

  await db.respondent.update({
    where: { id: respondentId },
    data: { deletedAt: null },
  });
  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "respondent.undeleted",
    targetType: "Respondent",
    targetId: respondentId,
    payload: { email: r.email },
  });
  return { ok: true };
}
