import { Card } from "@/components/ui/Card";
import { AdminNav } from "@/components/admin/AdminNav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Email events" };
export const dynamic = "force-dynamic";

export default async function EmailEventsPage() {
  await requirePlatformAdmin();

  const events = await db.emailEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: {
      invitation: {
        include: {
          assignment: {
            include: {
              respondent: true,
              surveyInstance: { include: { site: true } },
            },
          },
        },
      },
    },
  });

  return (
    <>
      <AdminNav active="/admin/email-events" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">
            Email events
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Deliverability feed
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every delivered, bounced, opened, complained, and failed event from
            the email provider's webhooks. Empty until Resend is wired (Phase
            0.D real-send swap).
          </p>
        </header>

        {events.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-muted">
            No email events yet — the mailer is currently in stub mode (links
            logged to <code>docker logs esg-app</code>). Once Resend is wired,
            its webhook will write rows here as they arrive.
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-3 text-sm"
              >
                <span className="flex items-baseline gap-3">
                  <code className="rounded bg-canvas px-2 py-0.5 text-xs">
                    {e.eventType}
                  </code>
                  <span className="text-ink">
                    {e.invitation.assignment.respondent.name} ·{" "}
                    {e.invitation.assignment.respondent.email}
                  </span>
                  <span className="text-xs text-muted">
                    {e.invitation.assignment.surveyInstance.site.name}
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {e.occurredAt.toISOString().replace("T", " ").slice(0, 19)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
