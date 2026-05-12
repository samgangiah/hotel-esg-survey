"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import { buildSnapshot } from "@/lib/report";
import type { Prisma } from "@prisma/client";

/**
 * Generate a report for a SurveyInstance — snapshots all answers + files +
 * section submissions into Report.snapshotJson, status='ready'. Each call
 * creates a new Report row so the operator gets versioning for free.
 */
export async function generateReport(
  instanceId: string
): Promise<
  { ok: true; reportId: string } | { ok: false; error: string }
> {
  const me = await requireOperatorAdmin();

  const instance = await db.surveyInstance.findUnique({
    where: { id: instanceId },
    include: {
      template: true,
      site: {
        include: {
          operator: true,
          buildings: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      answers: { include: { respondent: true } },
      sectionSubmissions: { include: { respondent: true } },
      uploadedFiles: {
        where: { deletedAt: null },
        include: { respondent: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!instance) return { ok: false, error: "Survey not found." };
  if (instance.site.operatorId !== me.operatorId) {
    return { ok: false, error: "Not your survey." };
  }

  const snapshot = buildSnapshot({
    generatedBy: { name: me.name, email: me.email },
    operator: { id: instance.site.operator.id, name: instance.site.operator.name },
    site: {
      id: instance.site.id,
      name: instance.site.name,
      address: instance.site.address,
    },
    buildings: instance.site.buildings.map((b) => ({ id: b.id, name: b.name })),
    instance: {
      id: instance.id,
      status: instance.status,
      createdAt: instance.createdAt,
      lockedAt: instance.lockedAt,
      template: {
        slug: instance.template.slug,
        version: instance.template.version,
        schemaJson: instance.template.schemaJson,
      },
    },
    answers: instance.answers,
    sectionSubmissions: instance.sectionSubmissions,
    uploadedFiles: instance.uploadedFiles,
  });

  const report = await db.report.create({
    data: {
      surveyInstanceId: instance.id,
      status: "ready",
      snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "report.generated",
    targetType: "Report",
    targetId: report.id,
    payload: {
      surveyInstanceId: instance.id,
      coveragePercent: snapshot.headline.coveragePercent,
      questionsAnswered: snapshot.headline.questionsAnswered,
      contributorCount: snapshot.headline.contributorCount,
    },
  });

  return { ok: true, reportId: report.id };
}
