import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendReminderEmail } from "@/lib/mailer";
import {
  nextReminderTier,
  REMINDER_DAYS,
  type ReminderTier,
} from "@/lib/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/reminders
 *
 * Drives the auto-reminder pass:
 *  - finds every active invitation (assignment not submitted, instance open,
 *    invitation unbound-or-bound but not expired)
 *  - for each, asks `nextReminderTier()` whether it's due
 *  - sends the email, bumps `remindersSent` + `lastReminderAt`
 *
 * Guarded by `CRON_SECRET` — call via:
 *    curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://esg.../api/cron/reminders
 *
 * Designed to be idempotent: any single invitation gets at most one reminder
 * per 24h, so running this hourly or daily is safe. Intended cron: daily at
 * 09:30 Europe/London. GET is also supported so it can be triggered by simple
 * cron jobs that pipe to curl with no extra flags.
 */
async function run(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured." },
      { status: 500 }
    );
  }

  const provided =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (!timingSafeEqualString(provided, expected)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  // Pull every plausible candidate. Filter further in code for clarity.
  // (At pilot scale this is ≤ low hundreds of rows — no need to optimise yet.)
  const now = new Date();
  const candidates = await db.invitation.findMany({
    where: {
      expiresAt: { gt: now },
      // Only invitations whose underlying assignment is still pending /
      // opened (not submitted) and whose instance is still open.
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

  // For each Assignment, only consider its most-recent invitation (we don't
  // want to keep nudging on a token the admin has already resent).
  const latestByAssignment = new Map<string, (typeof candidates)[number]>();
  for (const inv of candidates) {
    const existing = latestByAssignment.get(inv.assignmentId);
    if (!existing || inv.sentAt > existing.sentAt) {
      latestByAssignment.set(inv.assignmentId, inv);
    }
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const sent: Array<{
    invitationId: string;
    tier: ReminderTier;
    to: string;
  }> = [];
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
    if (r.emailInvalid) continue; // hard-bounce flag set by webhook

    // Important: we can't issue a fresh token here without invalidating the
    // previous binding. The reminder reuses the ORIGINAL link the user already
    // has. If they've lost the email, /recover gives them a fresh one — and
    // resetting `remindersSent` happens implicitly because /recover creates a
    // new Invitation row.
    //
    // For un-opened invitations, the link still hasn't been used. For opened
    // ones, the bound device is the only one that can use it — but that's
    // also the device they were filling on, so the reminder lands on the
    // right person.
    const tokenHashShort = inv.tokenHash.slice(0, 12); // never actually used
    void tokenHashShort;

    try {
      // The token isn't recoverable from `tokenHash` (one-way SHA-256), so we
      // can't reconstruct the magic-link URL for the original invitation.
      // Instead, point the reminder at /recover with a `prefill` so the user
      // can self-issue a fresh link with one click.
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
        data: {
          remindersSent: { increment: 1 },
          lastReminderAt: now,
        },
      });

      sent.push({ invitationId: inv.id, tier, to: r.email });
    } catch (e) {
      errors.push({
        invitationId: inv.id,
        error: e instanceof Error ? e.message : "send failed",
      });
    }
  }

  await audit({
    actorType: "system",
    action: "reminders.run",
    targetType: "CronJob",
    targetId: "reminders",
    payload: {
      considered: latestByAssignment.size,
      sent: sent.length,
      errors: errors.length,
      tiers: REMINDER_DAYS,
      breakdown: sent.reduce<Record<string, number>>((acc, s) => {
        const k = `tier${s.tier}`;
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    },
  });

  return NextResponse.json({
    ok: true,
    considered: latestByAssignment.size,
    sent: sent.length,
    errors,
  });
}

export async function POST(req: NextRequest) {
  return run(req);
}
export async function GET(req: NextRequest) {
  return run(req);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
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
