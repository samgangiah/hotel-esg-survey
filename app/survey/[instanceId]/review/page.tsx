import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireRespondent } from "@/lib/respondent-auth";
import { formSpec } from "@/lib/form-data";
import type { Answers, FormSpec } from "@/lib/schema";
import { Review } from "@/components/form/Review";
import { DbFormBackendProvider } from "@/components/form/backends/DbBackend";

export const metadata = { title: "Review your answers" };
export const dynamic = "force-dynamic";

export default async function SurveyInstanceReviewPage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const me = await requireRespondent();
  const { instanceId } = await params;

  const instance = await db.surveyInstance.findFirst({
    where: {
      id: instanceId,
      assignments: { some: { respondentId: me.respondentId } },
    },
    include: {
      template: true,
      site: { include: { operator: true } },
      assignments: { where: { respondentId: me.respondentId } },
      // All answers — the survey is shared across the team (see the survey
      // page for the rationale).
      answers: true,
      sectionSubmissions: { where: { respondentId: me.respondentId } },
    },
  });

  if (!instance) redirect("/survey");

  const lockedSpec: FormSpec =
    (instance.template?.schemaJson as unknown as FormSpec | undefined) ??
    formSpec;

  // Review shows the full template — same shared-visibility model as the
  // survey page. No role-based section/group filtering.

  const initialAnswers: Answers = {};
  for (const a of instance.answers) {
    initialAnswers[a.questionId] = a.valueJson as Answers[string];
  }
  const initialSubmittedSections: Record<string, boolean> = {};
  for (const s of instance.sectionSubmissions) {
    initialSubmittedSections[s.sectionId] = true;
  }

  const isClosed =
    instance.status === "submitted" || instance.status === "locked";

  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href={`/survey/${instance.id}`}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="text-xs font-medium">phs</span>
            </div>
            <div>
              <p className="font-display text-base leading-tight text-ink">
                {instance.site.name}
              </p>
              <p className="text-xs text-muted">
                {instance.site.operator.name} · signed in as {me.name}
              </p>
            </div>
          </Link>
        </div>
      </header>
      {isClosed && (
        <div className="border-b border-accent/30 bg-accent-soft/50">
          <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm text-accent-deep sm:px-6">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">This survey is closed.</span>{" "}
              {instance.lockedAt && (
                <>
                  Submitted on{" "}
                  <span className="font-medium">
                    {instance.lockedAt.toISOString().slice(0, 10)}
                  </span>
                  .{" "}
                </>
              )}
              Review is read-only.
            </p>
          </div>
        </div>
      )}
      <DbFormBackendProvider
        instanceId={instance.id}
        initialAnswers={initialAnswers}
        initialSubmittedSections={initialSubmittedSections}
        initialDelegations={{}}
        respondentName={me.name}
      >
        <Review
          spec={lockedSpec}
          basePath={`/survey/${instance.id}`}
          donePath="/done"
        />
      </DbFormBackendProvider>
    </div>
  );
}
