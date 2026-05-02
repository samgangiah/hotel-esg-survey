import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { requireRespondent } from "@/lib/respondent-auth";

export const metadata = { title: "Your survey" };
export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  const me = await requireRespondent();

  const assignments = await db.assignment.findMany({
    where: { respondentId: me.respondentId },
    include: {
      surveyInstance: { include: { site: true } },
      building: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (assignments.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Card className="space-y-3 p-8 sm:p-10">
          <h1 className="font-display text-2xl text-ink">No active surveys</h1>
          <p className="text-muted">
            You don't have any open survey assignments right now. If this looks wrong,
            ask your Site Admin to re-send your invitation.
          </p>
        </Card>
      </div>
    );
  }

  // For Phase 0.D, the runner UI itself isn't wired to the DB yet —
  // demo at / is unchanged. We show a welcome card with the user's assignments.
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted">Welcome</p>
        <h1 className="mt-1 font-display text-3xl text-ink">
          Hello, {me.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          You have {assignments.length} open assignment
          {assignments.length === 1 ? "" : "s"}.
        </p>
      </header>

      <Card className="divide-y divide-line">
        {assignments.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-5"
          >
            <div>
              <p className="font-medium text-ink">{a.surveyInstance.site.name}</p>
              <p className="text-xs text-muted">
                Section: <span className="font-mono">{a.sectionId}</span> · Role:{" "}
                {a.role}
                {a.building ? ` · Building: ${a.building.name}` : null}
              </p>
            </div>
            <span className="text-xs text-muted">{a.status}</span>
          </div>
        ))}
      </Card>

      <Card className="mt-6 space-y-3 p-6">
        <h2 className="font-display text-lg text-ink">What's next</h2>
        <p className="text-sm text-muted">
          The DB-backed survey runner is wired up in Phase 1. For Phase 0 the demo at{" "}
          <Link href="/" className="underline">
            esg.digitalrain.cloud
          </Link>{" "}
          is the rendering canvas — the platform plumbing on this page already
          remembers your invitation and identity.
        </p>
        <div>
          <Link href="/">
            <Button variant="secondary">Open the survey demo</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
