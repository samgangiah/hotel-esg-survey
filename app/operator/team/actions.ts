"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendInvitationEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import { ROLE_LABELS, type RoleKey } from "@/lib/roles";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

interface InviteArgs {
  name: string;
  email: string;
  roles: string[];
  buildingIds: string[]; // empty = all buildings (assignment.buildingId = null)
}

export async function inviteRespondent(
  args: InviteArgs
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  if (!args.name) return { ok: false, error: "Name required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email))
    return { ok: false, error: "Valid email required." };
  if (args.roles.length === 0)
    return { ok: false, error: "Pick at least one role." };

  // Resolve sites + survey instances within this operator. We attach
  // assignments to the operator's primary instance (one per site for now).
  const operator = await db.operator.findUnique({
    where: { id: me.operatorId },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          surveyInstances: { orderBy: { createdAt: "desc" }, take: 1 },
          buildings: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!operator) return { ok: false, error: "Operator not found." };

  // Validate building IDs all belong to this operator.
  const operatorBuildingIds = new Set(
    operator.sites.flatMap((s) => s.buildings.map((b) => b.id))
  );
  for (const bid of args.buildingIds) {
    if (!operatorBuildingIds.has(bid))
      return { ok: false, error: "Unknown building." };
  }

  // Map: which survey instance does each building belong to?
  const buildingToInstance = new Map<string, string>();
  for (const s of operator.sites) {
    const inst = s.surveyInstances[0];
    if (!inst) continue;
    for (const b of s.buildings) buildingToInstance.set(b.id, inst.id);
  }

  // Decide which buildings to assign. Empty list => all of them.
  const targetBuildingIds =
    args.buildingIds.length > 0
      ? args.buildingIds
      : Array.from(operatorBuildingIds);
  if (targetBuildingIds.length === 0)
    return { ok: false, error: "No buildings exist on this operator." };

  // Atomic: create or get respondent (per email/operator), create one
  // assignment per (role × building), create a single invitation token.
  const result = await db.$transaction(async (tx) => {
    const respondent = await tx.respondent.upsert({
      where: {
        operatorId_email: { operatorId: me.operatorId, email: args.email },
      },
      update: { name: args.name },
      create: {
        operatorId: me.operatorId,
        email: args.email,
        name: args.name,
        isOperatorAdmin: false,
      },
    });

    // Create assignments — one per (role, building). Idempotent via the
    // composite unique index on Assignment.
    const created: { id: string }[] = [];
    for (const role of args.roles) {
      for (const buildingId of targetBuildingIds) {
        const surveyInstanceId = buildingToInstance.get(buildingId);
        if (!surveyInstanceId) continue;
        const a = await tx.assignment.upsert({
          where: {
            surveyInstanceId_respondentId_role_sectionId_buildingId: {
              surveyInstanceId,
              respondentId: respondent.id,
              role,
              sectionId: "all",
              buildingId,
            },
          },
          update: {},
          create: {
            surveyInstanceId,
            respondentId: respondent.id,
            role,
            sectionId: "all",
            buildingId,
          },
        });
        created.push({ id: a.id });
      }
    }

    if (created.length === 0)
      throw new Error(
        "No survey instance available for those buildings — start an instance first."
      );

    // One invitation token covers them all (we attach to the first assignment
    // for the relation; the magic link logs the respondent in regardless).
    const { token, hash } = newToken();
    await tx.invitation.create({
      data: {
        assignmentId: created[0].id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
      },
    });

    return { respondent, token, assignmentCount: created.length };
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/r/${result.token}`;
  const roleLabels = args.roles
    .map((k) => ROLE_LABELS[k as RoleKey] ?? k)
    .join(", ");
  await sendInvitationEmail({
    to: args.email,
    toName: args.name,
    magicLink,
    siteName: operator.name,
    inviterName: me.name,
    roleLabel: roleLabels,
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "respondent.invited",
    targetType: "Respondent",
    targetId: result.respondent.id,
    payload: {
      email: args.email,
      roles: args.roles,
      buildingIds: targetBuildingIds,
      assignmentCount: result.assignmentCount,
    },
  });

  return { ok: true, email: args.email };
}

export async function resendInvitationOp(
  assignmentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      respondent: true,
      surveyInstance: { include: { site: true } },
    },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (assignment.respondent.operatorId !== me.operatorId)
    return { ok: false, error: "Not your operator." };

  // Expire all current invitations for this assignment.
  await db.invitation.updateMany({
    where: { assignmentId, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date(0), boundSessionId: null },
  });

  const { token, hash } = newToken();
  await db.invitation.create({
    data: {
      assignmentId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/r/${token}`;
  await sendInvitationEmail({
    to: assignment.respondent.email,
    toName: assignment.respondent.name,
    magicLink,
    siteName: assignment.surveyInstance.site.name,
    inviterName: me.name,
    roleLabel: assignment.role,
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "invitation.resent",
    targetType: "Assignment",
    targetId: assignmentId,
  });

  return { ok: true };
}
