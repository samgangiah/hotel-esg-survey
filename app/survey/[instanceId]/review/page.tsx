import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRespondent } from "@/lib/respondent-auth";
import { formSpec } from "@/lib/form-data";
import { computeScope, visibleSpec } from "@/lib/scope";
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
      answers: { where: { respondentId: me.respondentId } },
      sectionSubmissions: { where: { respondentId: me.respondentId } },
    },
  });

  if (!instance) redirect("/survey");

  const lockedSpec: FormSpec =
    (instance.template?.schemaJson as unknown as FormSpec | undefined) ??
    formSpec;

  const scope = computeScope({
    assignments: instance.assignments.map((a) => ({
      role: a.role,
      buildingId: a.buildingId,
    })),
    isOperatorAdmin: me.isOperatorAdmin,
  });
  const scopedSpec = visibleSpec(lockedSpec, scope);

  const initialAnswers: Answers = {};
  for (const a of instance.answers) {
    initialAnswers[a.questionId] = a.valueJson as Answers[string];
  }
  const initialSubmittedSections: Record<string, boolean> = {};
  for (const s of instance.sectionSubmissions) {
    initialSubmittedSections[s.sectionId] = true;
  }

  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href={`/survey/${instance.id}`}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="font-display text-base">e</span>
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
      <DbFormBackendProvider
        instanceId={instance.id}
        initialAnswers={initialAnswers}
        initialSubmittedSections={initialSubmittedSections}
      >
        <Review
          spec={scopedSpec}
          basePath={`/survey/${instance.id}`}
          donePath="/done"
        />
      </DbFormBackendProvider>
    </div>
  );
}
