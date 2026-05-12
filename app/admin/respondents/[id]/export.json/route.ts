import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * GDPR per-respondent subject-access export.
 *
 * Returns everything the system holds about a single Respondent —
 * answers they wrote, files they uploaded, sessions they had, invitations
 * targeted at them, section submissions they made, and email events on
 * their invitations. Excludes platform-wide audit log entries by design
 * (they reference targets, not actors-as-data-subjects, except where the
 * respondent IS the actor — those are included).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requirePlatformAdmin();
  const { id } = await params;

  const r = await db.respondent.findUnique({
    where: { id },
    include: {
      operator: true,
      assignments: {
        include: {
          surveyInstance: { include: { site: true } },
          building: true,
          invitations: {
            include: { emailEvents: true },
            orderBy: { sentAt: "asc" },
          },
        },
      },
      sessions: { orderBy: { createdAt: "asc" } },
      answers: { include: { surveyInstance: true, building: true } },
      sectionSubmissions: { include: { surveyInstance: true } },
      uploadedFiles: {
        where: { deletedAt: null },
        include: { surveyInstance: true },
      },
    },
  });
  if (!r) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auditEntries = await db.auditLog.findMany({
    where: { actorType: "respondent", actorId: r.id },
    orderBy: { occurredAt: "asc" },
    take: 5000,
  });

  const dump = {
    exportedAt: new Date().toISOString(),
    exportedBy: { email: me.email, name: me.name },
    purpose: "GDPR subject access request",
    respondent: {
      id: r.id,
      email: r.email,
      name: r.name,
      phone: r.phone,
      isOperatorAdmin: r.isOperatorAdmin,
      emailInvalid: r.emailInvalid,
      operator: { id: r.operator.id, name: r.operator.name },
      createdAt: r.createdAt,
      deletedAt: r.deletedAt,
    },
    assignments: r.assignments.map((a) => ({
      id: a.id,
      role: a.role,
      sectionId: a.sectionId,
      status: a.status,
      building: a.building?.name ?? null,
      site: a.surveyInstance.site.name,
      surveyInstanceId: a.surveyInstanceId,
      createdAt: a.createdAt,
      invitations: a.invitations.map((inv) => ({
        sentAt: inv.sentAt,
        openedAt: inv.openedAt,
        expiresAt: inv.expiresAt,
        remindersSent: inv.remindersSent,
        lastReminderAt: inv.lastReminderAt,
        emailEvents: inv.emailEvents.map((e) => ({
          eventType: e.eventType,
          occurredAt: e.occurredAt,
          payload: e.payloadJson,
        })),
      })),
    })),
    sessions: r.sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
    })),
    answers: r.answers.map((a) => ({
      questionId: a.questionId,
      buildingName: a.building.name,
      value: a.valueJson,
      answeredAt: a.answeredAt,
      updatedAt: a.updatedAt,
    })),
    sectionSubmissions: r.sectionSubmissions.map((s) => ({
      sectionId: s.sectionId,
      submittedAt: s.submittedAt,
    })),
    uploadedFiles: r.uploadedFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      byteSize: f.byteSize,
      mimeType: f.mimeType,
      questionId: f.questionId,
      createdAt: f.createdAt,
      downloadUrl: `/api/uploads/${f.id}`,
    })),
    actionsByThisRespondent: auditEntries.map((a) => ({
      action: a.action,
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
    action: "respondent.export",
    targetType: "Respondent",
    targetId: r.id,
    payload: {
      email: r.email,
      answerCount: r.answers.length,
      fileCount: r.uploadedFiles.length,
    },
  });

  const safeEmail = r.email.replace(/[^a-z0-9._@-]/gi, "-");
  const ts = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gdpr-${safeEmail}-${ts}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
