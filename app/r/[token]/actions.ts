"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { setRespondentSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function confirmIdentity(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokenHash = hashToken(token);

  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { assignment: { include: { respondent: true } } },
  });
  if (!invitation) return { ok: false, error: "Link not found." };
  if (invitation.expiresAt < new Date()) return { ok: false, error: "Link expired." };

  const h = await headers();
  const userAgent = h.get("user-agent") ?? null;
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  // Multi-device: each click creates its own Session row. The Invitation's
  // openedAt + boundSessionId fields are set only on the FIRST click (kept
  // for audit / forensic trail); subsequent clicks just add fresh sessions.
  const session = await db.$transaction(async (tx) => {
    const s = await tx.session.create({
      data: {
        respondentId: invitation.assignment.respondent.id,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + NINETY_DAYS_MS),
      },
    });
    if (!invitation.openedAt) {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { openedAt: new Date(), boundSessionId: s.id },
      });
    }
    await tx.assignment.update({
      where: { id: invitation.assignmentId },
      data: { status: "opened" },
    });
    return s;
  });

  await setRespondentSession(session.id);
  await audit({
    actorType: "respondent",
    actorId: invitation.assignment.respondent.id,
    action: "invitation.confirmed",
    targetType: "Invitation",
    targetId: invitation.id,
  });

  return { ok: true };
}

export async function denyIdentity(token: string): Promise<{ ok: true }> {
  const tokenHash = hashToken(token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { assignment: { include: { respondent: true } } },
  });
  if (!invitation) return { ok: true };

  // Invalidate by expiring the token (don't delete — preserve audit trail).
  await db.invitation.update({
    where: { id: invitation.id },
    data: { expiresAt: new Date(0) },
  });

  await audit({
    actorType: "respondent",
    actorId: invitation.assignment.respondent.id,
    action: "invitation.denied",
    targetType: "Invitation",
    targetId: invitation.id,
  });

  // TODO Phase 1: notify the Site Admin.

  return { ok: true };
}
