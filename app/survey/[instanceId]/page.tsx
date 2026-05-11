import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRespondent } from "@/lib/respondent-auth";
import { formSpec } from "@/lib/form-data";
import { computeScope, visibleSpec } from "@/lib/scope";
import type { Answers, FormSpec } from "@/lib/schema";
import { DbSurveyShell } from "@/components/form/db/DbSurveyShell";

export const dynamic = "force-dynamic";

export default async function SurveyInstancePage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireRespondent();
  const { instanceId } = await params;
  const sp = await searchParams;

  // Load the instance + template + this respondent's assignments + existing
  // answers + existing section submissions, in one shot.
  const instance = await db.surveyInstance.findFirst({
    where: {
      id: instanceId,
      assignments: { some: { respondentId: me.respondentId } },
    },
    include: {
      template: true,
      site: { include: { operator: true, buildings: { where: { deletedAt: null } } } },
      assignments: { where: { respondentId: me.respondentId } },
      answers: {
        where: { respondentId: me.respondentId },
      },
      sectionSubmissions: { where: { respondentId: me.respondentId } },
    },
  });

  if (!instance) {
    redirect("/survey");
  }

  // Use the template version locked to this instance — not whatever the
  // current questions.json on disk says. (Falls back to the in-repo formSpec
  // if the DB row is missing the schema for some reason.)
  const lockedSpec: FormSpec =
    (instance.template?.schemaJson as unknown as FormSpec | undefined) ??
    formSpec;

  // Compute respondent's scope + filter the template down to what they can see.
  const scope = computeScope({
    assignments: instance.assignments.map((a) => ({
      role: a.role,
      buildingId: a.buildingId,
    })),
    isOperatorAdmin:
      me.isOperatorAdmin ||
      instance.assignments.some((a) => a.sectionId === "all"),
  });
  const scopedSpec = visibleSpec(lockedSpec, scope);

  // Project answers from DB rows into a flat { questionId → value } map.
  const initialAnswers: Answers = {};
  for (const a of instance.answers) {
    // Site/org-level answers are anchored to primary building; we expose them
    // unconditionally. Building-level answers for the respondent's first
    // scoped building also surface here. (Multi-building UI is Phase later.)
    initialAnswers[a.questionId] = a.valueJson as Answers[string];
  }

  const initialSubmittedSections: Record<string, boolean> = {};
  for (const s of instance.sectionSubmissions) {
    initialSubmittedSections[s.sectionId] = true;
  }

  const showCoverByDefault = !sp.section;

  return (
    <DbSurveyShell
      instanceId={instance.id}
      spec={scopedSpec}
      initialAnswers={initialAnswers}
      initialSubmittedSections={initialSubmittedSections}
      respondentName={me.name}
      siteName={instance.site.name}
      operatorName={instance.site.operator.name}
      showCoverByDefault={showCoverByDefault}
    />
  );
}
