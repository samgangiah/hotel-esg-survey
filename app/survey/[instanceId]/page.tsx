import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRespondent } from "@/lib/respondent-auth";
import { formSpec } from "@/lib/form-data";
import { computeScope, visibleSpec } from "@/lib/scope";
import type { Answers, FormSpec } from "@/lib/schema";
import { DbSurveyShell } from "@/components/form/db/DbSurveyShell";
import type { DelegationView } from "@/components/form/state-context";

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
  // `isOperatorAdmin` is the only thing that unlocks every section; the
  // `sectionId === "all"` value on Assignment rows is just a sentinel we use
  // until per-section assignments are first-class — it is NOT a permission.
  const scope = computeScope({
    assignments: instance.assignments.map((a) => ({
      role: a.role,
      buildingId: a.buildingId,
    })),
    isOperatorAdmin: me.isOperatorAdmin,
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

  const isClosed =
    instance.status === "submitted" || instance.status === "locked";

  // Load active delegations across this instance — anything not answered or
  // cancelled is shown in-place. One row per question (latest wins).
  const delegationRows = await db.questionDelegation.findMany({
    where: { surveyInstanceId: instance.id },
    include: { delegatedBy: true, parent: { include: { delegatedBy: true } } },
    orderBy: { createdAt: "desc" },
  });
  const initialDelegations: Record<string, DelegationView> = {};
  for (const d of delegationRows) {
    // Only consider the most recent per question (we ordered desc, so first
    // one wins).
    if (initialDelegations[d.questionId]) continue;
    if (d.answeredAt || d.cancelledAt) continue;
    initialDelegations[d.questionId] = {
      id: d.id,
      delegatedToEmail: d.delegatedToEmail,
      delegatedToName: d.delegatedToName,
      delegatedByName: d.delegatedBy.name,
      delegatedByEmail: d.delegatedBy.email,
      forwardedFromEmail: d.parent?.delegatedBy.email ?? null,
      answeredAt: null,
      cancelledAt: null,
      createdAt: d.createdAt.toISOString(),
    };
  }

  return (
    <DbSurveyShell
      instanceId={instance.id}
      spec={scopedSpec}
      initialAnswers={initialAnswers}
      initialSubmittedSections={initialSubmittedSections}
      initialDelegations={initialDelegations}
      respondentName={me.name}
      siteName={instance.site.name}
      operatorName={instance.site.operator.name}
      showCoverByDefault={showCoverByDefault}
      isClosed={isClosed}
      closedAt={instance.lockedAt}
    />
  );
}
