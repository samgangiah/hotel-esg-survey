import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { requireRespondent } from "@/lib/respondent-auth";

export const metadata = { title: "Your survey" };
export const dynamic = "force-dynamic";

/**
 * Resolves the respondent's active survey instance and redirects to
 * /survey/[instanceId]. If there are multiple, lists them. If none, shows a
 * friendly "no assignments yet" state.
 */
export default async function SurveyResolver() {
  const me = await requireRespondent();

  const assignments = await db.assignment.findMany({
    where: { respondentId: me.respondentId },
    include: {
      surveyInstance: { include: { site: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Distinct instances the respondent has any assignment on.
  const instanceMap = new Map<
    string,
    {
      id: string;
      siteName: string;
      status: string;
      assignmentCount: number;
    }
  >();
  for (const a of assignments) {
    const existing = instanceMap.get(a.surveyInstanceId);
    if (existing) {
      existing.assignmentCount += 1;
    } else {
      instanceMap.set(a.surveyInstanceId, {
        id: a.surveyInstanceId,
        siteName: a.surveyInstance.site.name,
        status: a.surveyInstance.status,
        assignmentCount: 1,
      });
    }
  }

  const instances = Array.from(instanceMap.values());

  if (instances.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Card className="space-y-3 p-8 sm:p-10">
          <h1 className="font-display text-2xl text-ink">No active surveys</h1>
          <p className="text-muted">
            You don&apos;t have any open survey assignments right now. If this
            looks wrong, ask your Operator Admin to re-send your invitation.
          </p>
        </Card>
      </div>
    );
  }

  if (instances.length === 1) {
    redirect(`/survey/${instances[0].id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted">Surveys</p>
        <h1 className="mt-1 font-display text-3xl text-ink">
          Hello, {me.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          You have {instances.length} active surveys. Pick one to continue.
        </p>
      </header>
      <Card className="divide-y divide-line">
        {instances.map((i) => (
          <Link
            key={i.id}
            href={`/survey/${i.id}`}
            className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4 transition-colors hover:bg-accent-soft/30"
          >
            <span>
              <span className="font-medium text-ink">{i.siteName}</span>
              <span className="ml-2 text-xs text-muted">
                {i.assignmentCount} assignment
                {i.assignmentCount === 1 ? "" : "s"}
              </span>
            </span>
            <span className="text-xs text-muted">{i.status}</span>
          </Link>
        ))}
      </Card>
      <p className="mt-6 text-center">
        <Link href="/">
          <Button variant="ghost" size="sm">
            Back to home
          </Button>
        </Link>
      </p>
    </div>
  );
}
