import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { AdminNav } from "@/components/admin/AdminNav";
import { RunRemindersButton } from "@/components/admin/RunRemindersButton";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { REMINDER_DAYS } from "@/lib/reminders";
import { adminRunReminders } from "./actions";

export const metadata = { title: "Reminders" };
export const dynamic = "force-dynamic";

/**
 * Platform-admin view onto the auto-reminder pipeline:
 *  - current state: who's due next pass, who's been reminded, who's done
 *  - history: last 50 `reminders.run` audit rows
 *  - "Run pass now" button to fire the same logic the daily cron uses
 */
export default async function RemindersAdminPage() {
  await requirePlatformAdmin();

  const now = new Date();

  // Snapshot the same set the cron looks at — every active invitation,
  // deduped to the latest one per assignment.
  const candidates = await db.invitation.findMany({
    where: {
      expiresAt: { gt: now },
      assignment: {
        status: { notIn: ["submitted", "abandoned"] },
        surveyInstance: { status: { notIn: ["submitted", "locked"] } },
      },
    },
    include: {
      assignment: {
        include: {
          respondent: true,
          surveyInstance: { include: { site: { include: { operator: true } } } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });
  const latestByAssignment = new Map<string, (typeof candidates)[number]>();
  for (const inv of candidates) {
    const existing = latestByAssignment.get(inv.assignmentId);
    if (!existing || inv.sentAt > existing.sentAt) {
      latestByAssignment.set(inv.assignmentId, inv);
    }
  }
  const active = Array.from(latestByAssignment.values()).sort(
    (a, b) => a.sentAt.getTime() - b.sentAt.getTime()
  );

  const recentRuns = await db.auditLog.findMany({
    where: { action: "reminders.run" },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });

  return (
    <>
      <AdminNav active="/admin/reminders" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Reminders
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink">
              Auto-reminders
            </h1>
            <p className="mt-1 text-sm text-muted">
              Cadence: tier 1 at {REMINDER_DAYS[1]} days · tier 2 at{" "}
              {REMINDER_DAYS[2]} days · tier 3 at {REMINDER_DAYS[3]} days.
              Daily cron fires at 09:30 Europe/London. Each invitation gets at
              most one reminder per 24h.
            </p>
          </div>
          <RunRemindersButton onRun={adminRunReminders} />
        </header>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-lg text-ink">
            Active invitations
          </h2>
          {active.length === 0 ? (
            <Card className="px-6 py-8 text-center text-sm text-muted">
              No active invitations — every assignment is either submitted or
              its instance is closed.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {active.map((inv) => {
                const a = inv.assignment;
                const r = a.respondent;
                const daysSinceSent =
                  (now.getTime() - inv.sentAt.getTime()) / (24 * 60 * 60 * 1000);
                return (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-3 text-sm"
                  >
                    <span className="flex flex-col">
                      <span>
                        <span className="font-medium text-ink">{r.name}</span>{" "}
                        <span className="text-xs text-muted">
                          {r.email}
                          {r.emailInvalid && (
                            <Pill className="ml-2 border-danger/40 bg-danger/10 text-danger">
                              email invalid · skipped
                            </Pill>
                          )}
                        </span>
                      </span>
                      <span className="text-xs text-muted">
                        {a.surveyInstance.site.operator.name} ·{" "}
                        {a.surveyInstance.site.name} · section {a.sectionId} ·{" "}
                        role {a.role}
                      </span>
                    </span>
                    <span className="flex flex-col items-end text-xs text-muted">
                      <span>
                        sent {daysSinceSent.toFixed(1)}d ago · tier{" "}
                        {inv.remindersSent}/3
                      </span>
                      {inv.lastReminderAt && (
                        <span>
                          last reminder{" "}
                          {inv.lastReminderAt
                            .toISOString()
                            .replace("T", " ")
                            .slice(0, 16)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg text-ink">
            Recent passes
          </h2>
          {recentRuns.length === 0 ? (
            <Card className="px-6 py-8 text-center text-sm text-muted">
              No reminder passes recorded yet.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {recentRuns.map((r) => {
                const p = (r.payloadJson ?? {}) as {
                  considered?: number;
                  sent?: number;
                  errors?: number;
                  triggeredBy?: string;
                  breakdown?: Record<string, number>;
                };
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-3 text-sm"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium text-ink">
                        sent {p.sent ?? 0} / {p.considered ?? 0} considered
                      </span>
                      {p.breakdown &&
                        Object.entries(p.breakdown).map(([k, v]) => (
                          <Pill key={k}>
                            {k}={v}
                          </Pill>
                        ))}
                      {p.errors && p.errors > 0 ? (
                        <Pill className="border-danger/40 bg-danger/10 text-danger">
                          {p.errors} errors
                        </Pill>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted">
                      {p.triggeredBy ?? r.actorType} ·{" "}
                      {r.occurredAt
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
