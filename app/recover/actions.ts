"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendRecoveryEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";
import { safeNextPath } from "@/lib/safe-redirect";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_COUNT = 3;

/**
 * Self-service magic-link recovery.
 *
 * The caller passes an email; we look up every Respondent row that matches
 * (across operators — a person could in theory be invited by more than one),
 * expire all their active invitations, mint fresh ones, and email each.
 *
 * The response is intentionally identical regardless of whether the email
 * matches any account — we don't want to leak which addresses are on file.
 * Audit-log every attempt, and rate-limit at 3 requests per email per 10 min
 * by counting recent `recovery.requested` rows for that email.
 */
export async function requestRecovery(
  rawEmail: string,
  rawNext?: string | null
): Promise<{ ok: true }> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  // Post-sign-in destination, if this recovery came from a deep link.
  // Re-validated here — never trust a path that's travelled through a form.
  const nextPath = safeNextPath(rawNext);

  // Audit + rate-limit even on empty input so we don't leak timing.
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    await audit({
      actorType: "system",
      action: "recovery.requested",
      targetType: "Email",
      targetId: email || "(empty)",
      payload: { result: "invalid_email" },
    });
    return { ok: true };
  }

  // Cheap rate limit using the existing AuditLog table. We don't want to add
  // a dedicated counter just for this.
  const recent = await db.auditLog.count({
    where: {
      action: "recovery.requested",
      targetType: "Email",
      targetId: email,
      occurredAt: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  });
  if (recent >= RATE_LIMIT_COUNT) {
    await audit({
      actorType: "system",
      action: "recovery.requested",
      targetType: "Email",
      targetId: email,
      payload: { result: "rate_limited", recent },
    });
    return { ok: true };
  }

  const respondents = await db.respondent.findMany({
    where: { email, deletedAt: null },
    include: {
      assignments: {
        include: {
          surveyInstance: { include: { site: true } },
          building: true,
        },
      },
    },
  });

  if (respondents.length === 0) {
    await audit({
      actorType: "system",
      action: "recovery.requested",
      targetType: "Email",
      targetId: email,
      payload: { result: "no_match" },
    });
    return { ok: true };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  let issued = 0;

  for (const r of respondents) {
    for (const a of r.assignments) {
      // Skip assignments on instances that are locked — those are read-only
      // anyway, so a fresh link wouldn't unlock any value.
      if (
        a.surveyInstance.status === "locked" ||
        a.surveyInstance.status === "submitted"
      ) {
        continue;
      }

      // Expire any active invitations and clear bindings.
      await db.invitation.updateMany({
        where: { assignmentId: a.id, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date(0), boundSessionId: null },
      });

      const { token, hash } = newToken();
      await db.invitation.create({
        data: {
          assignmentId: a.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
          nextPath,
        },
      });

      const roleLabel = r.isOperatorAdmin
        ? "Operator Admin (full survey access)"
        : `${prettyRole(a.role)}${a.building ? ` · ${a.building.name}` : ""}`;

      await sendRecoveryEmail({
        to: r.email,
        toName: r.name,
        magicLink: `${appUrl}/r/${token}`,
        siteName: a.surveyInstance.site.name,
        roleLabel,
      });
      issued += 1;
    }
  }

  await audit({
    actorType: "system",
    action: "recovery.requested",
    targetType: "Email",
    targetId: email,
    payload: {
      result: issued > 0 ? "sent" : "no_active_assignment",
      respondentCount: respondents.length,
      issued,
    },
  });

  return { ok: true };
}

function prettyRole(role: string): string {
  const map: Record<string, string> = {
    gm: "General Manager",
    engineering: "Engineering / Maintenance",
    housekeeping: "Housekeeping",
    laundry: "Laundry",
    finance: "Finance",
    energy_manager: "Energy / ESG Manager",
  };
  return map[role] ?? role;
}
