import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Platform Admin download: full operator dump as JSON.
 *
 * Returns everything we hold for this operator across sites, buildings,
 * respondents, instances, assignments, invitations, answers, section
 * submissions, recent email events, recent audit-log entries, and an inventory
 * of uploaded files per instance (with their /api/uploads/:id URLs).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requirePlatformAdmin();
  const { id } = await params;

  const operator = await db.operator.findFirst({
    where: { id, deletedAt: null },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          buildings: { where: { deletedAt: null } },
          surveyInstances: {
            include: {
              template: true,
              answers: { include: { respondent: true, building: true } },
              assignments: { include: { respondent: true, building: true } },
              sectionSubmissions: { include: { respondent: true } },
              reports: true,
              uploadedFiles: {
                where: { deletedAt: null },
                include: { respondent: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
      respondents: {
        where: { deletedAt: null },
        include: {
          assignments: { include: { invitations: true } },
          sessions: true,
        },
      },
    },
  });
  if (!operator) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const emailEvents = await db.emailEvent.findMany({
    where: {
      invitation: {
        assignment: { respondent: { operatorId: operator.id } },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: 1000,
    include: { invitation: { include: { assignment: { include: { respondent: true } } } } },
  });

  const auditEntries = await db.auditLog.findMany({
    where: {
      OR: [
        { targetType: "Operator", targetId: operator.id },
        { targetType: "Site", targetId: { in: operator.sites.map((s) => s.id) } },
        {
          targetType: "Assignment",
          targetId: {
            in: operator.sites.flatMap((s) =>
              s.surveyInstances.flatMap((i) => i.assignments.map((a) => a.id))
            ),
          },
        },
        {
          targetType: "SurveyInstance",
          targetId: {
            in: operator.sites.flatMap((s) =>
              s.surveyInstances.map((i) => i.id)
            ),
          },
        },
      ],
    },
    orderBy: { occurredAt: "desc" },
    take: 1000,
  });

  const dump = {
    exportedAt: new Date().toISOString(),
    exportedBy: { email: me.email, name: me.name },
    operator: {
      id: operator.id,
      name: operator.name,
      createdAt: operator.createdAt,
    },
    sites: operator.sites.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      primaryBuildingId: s.primaryBuildingId,
      buildings: s.buildings.map((b) => ({
        id: b.id,
        name: b.name,
        createdAt: b.createdAt,
      })),
      surveyInstances: s.surveyInstances.map((i) => ({
        id: i.id,
        templateSlug: i.template.slug,
        templateVersion: i.template.version,
        status: i.status,
        createdAt: i.createdAt,
        lockedAt: i.lockedAt,
        assignments: i.assignments.map((a) => ({
          id: a.id,
          role: a.role,
          sectionId: a.sectionId,
          buildingId: a.buildingId,
          buildingName: a.building?.name ?? null,
          respondent: {
            id: a.respondent.id,
            email: a.respondent.email,
            name: a.respondent.name,
            isOperatorAdmin: a.respondent.isOperatorAdmin,
          },
          status: a.status,
        })),
        answers: i.answers.map((a) => ({
          questionId: a.questionId,
          buildingId: a.buildingId,
          buildingName: a.building.name,
          respondent: {
            id: a.respondent.id,
            email: a.respondent.email,
            name: a.respondent.name,
          },
          value: a.valueJson,
          answeredAt: a.answeredAt,
          updatedAt: a.updatedAt,
        })),
        sectionSubmissions: i.sectionSubmissions.map((s) => ({
          sectionId: s.sectionId,
          respondent: {
            id: s.respondent.id,
            name: s.respondent.name,
          },
          submittedAt: s.submittedAt,
        })),
        reports: i.reports.map((r) => ({
          id: r.id,
          status: r.status,
          generatedAt: r.generatedAt,
          pdfPath: r.pdfPath,
        })),
        uploadedFiles: i.uploadedFiles.map((f) => ({
          id: f.id,
          questionId: f.questionId,
          repeaterParentId: f.repeaterParentId,
          repeaterIndex: f.repeaterIndex,
          buildingId: f.buildingId,
          respondent: {
            id: f.respondent.id,
            email: f.respondent.email,
            name: f.respondent.name,
          },
          filename: f.filename,
          byteSize: f.byteSize,
          mimeType: f.mimeType,
          storageBackend: f.storageBackend,
          storagePath: f.storagePath,
          downloadUrl: `/api/uploads/${f.id}`,
          createdAt: f.createdAt,
        })),
      })),
    })),
    respondents: operator.respondents.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      isOperatorAdmin: r.isOperatorAdmin,
      emailInvalid: r.emailInvalid,
      createdAt: r.createdAt,
      sessions: r.sessions.map((s) => ({
        id: s.id,
        ip: s.ip,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
      })),
      invitations: r.assignments.flatMap((a) =>
        a.invitations.map((inv) => ({
          assignmentId: inv.assignmentId,
          sentAt: inv.sentAt,
          openedAt: inv.openedAt,
          expiresAt: inv.expiresAt,
        }))
      ),
    })),
    emailEvents: emailEvents.map((e) => ({
      eventType: e.eventType,
      occurredAt: e.occurredAt,
      payload: e.payloadJson,
      respondent: e.invitation.assignment.respondent.email,
    })),
    auditLog: auditEntries.map((a) => ({
      action: a.action,
      actorType: a.actorType,
      actorId: a.actorId,
      targetType: a.targetType,
      targetId: a.targetId,
      payload: a.payloadJson,
      occurredAt: a.occurredAt,
      ip: a.ip,
    })),
  };

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "operator.export.json",
    targetType: "Operator",
    targetId: operator.id,
    payload: {
      respondentCount: operator.respondents.length,
      answerCount: operator.sites.reduce(
        (acc, s) => acc + s.surveyInstances.reduce((a, i) => a + i.answers.length, 0),
        0
      ),
    },
  });

  const safeName = operator.name.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const ts = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-${ts}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
