/**
 * Core reminder-pass logic, extracted so both the cron endpoint and the
 * `/admin/reminders` "Run pass now" button can call it without duplicating
 * code. Pure side-effects (DB writes + email sends + audit log).
 */

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendReminderEmail } from "@/lib/mailer";
import { nextReminderTier, REMINDER_DAYS, type ReminderTier } from "@/lib/reminders";

export interface ReminderPassResult {
  considered: number;
  sent: number;
  breakdown: Record<string, number>;
  errors: Array<{ invitationId: string; error: string }>;
}

export async function runReminderPass(opts: {
  triggeredBy: "cron" | "platform_admin";
  actorId?: string;
}): Promise<ReminderPassResult> {
  const now = new Date();
  const candidates = await db.invitation.findMany({
    where: {
      expiresAt: { gt: now },
      assignment: {
        status: { notIn: ["submitted", "abandoned"] },
        surveyInstance: {
          status: { notIn: ["submitted", "locked"] },
        },
      },
    },
    include: {
      assignment: {
        include: {
          respondent: true,
          surveyInstance: { include: { site: true } },
          building: true,
        },
      },
    },
  });

  // Latest invitation per assignment wins.
  const latestByAssignment = new Map<string, (typeof candidates)[number]>();
  for (const inv of candidates) {
    const existing = latestByAssignment.get(inv.assignmentId);
    if (!existing || inv.sentAt > existing.sentAt) {
      latestByAssignment.set(inv.assignmentId, inv);
    }
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const sent: Array<{ invitationId: string; tier: ReminderTier; to: string }> = [];
  const errors: Array<{ invitationId: string; error: string }> = [];

  for (const inv of latestByAssignment.values()) {
    const tier = nextReminderTier(
      {
        invitationSentAt: inv.sentAt,
        remindersSent: inv.remindersSent,
        lastReminderAt: inv.lastReminderAt,
      },
      now
    );
    if (tier === null) continue;

    const a = inv.assignment;
    const r = a.respondent;
    if (r.emailInvalid) continue;

    try {
      const magicLink = `${appUrl}/recover?email=${encodeURIComponent(r.email)}`;
      await sendReminderEmail({
        to: r.email,
        toName: r.name,
        magicLink,
        siteName: a.surveyInstance.site.name,
        roleLabel: r.isOperatorAdmin
          ? "Operator Admin (full survey access)"
          : `${prettyRole(a.role)}${a.building ? ` · ${a.building.name}` : ""}`,
        tier,
      });
      await db.invitation.update({
        where: { id: inv.id },
        data: { remindersSent: { increment: 1 }, lastReminderAt: now },
      });
      sent.push({ invitationId: inv.id, tier, to: r.email });
    } catch (e) {
      errors.push({
        invitationId: inv.id,
        error: e instanceof Error ? e.message : "send failed",
      });
    }
  }

  const breakdown = sent.reduce<Record<string, number>>((acc, s) => {
    const k = `tier${s.tier}`;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  await audit({
    actorType: opts.triggeredBy === "cron" ? "system" : "platform_admin",
    actorId: opts.actorId,
    action: "reminders.run",
    targetType: "CronJob",
    targetId: "reminders",
    payload: {
      triggeredBy: opts.triggeredBy,
      considered: latestByAssignment.size,
      sent: sent.length,
      errors: errors.length,
      tiers: REMINDER_DAYS,
      breakdown,
    },
  });

  return {
    considered: latestByAssignment.size,
    sent: sent.length,
    breakdown,
    errors,
  };
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
