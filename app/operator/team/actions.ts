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

/**
 * Edit an existing team member's roles + building scope. Reconciles the
 * Assignment rows: creates the newly-wanted ones, deletes the no-longer-
 * wanted ones, and repoints the respondent's invitations onto a surviving
 * assignment so the magic link keeps working.
 *
 * Answers are NOT touched — they're keyed by (instance, question, building),
 * never by assignment — so changing someone's roles never loses data.
 */
export async function updateRespondentRoles(args: {
  respondentId: string;
  roles: string[];
  buildingIds: string[]; // empty = all buildings
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  if (args.roles.length === 0)
    return { ok: false, error: "Pick at least one role." };

  const respondent = await db.respondent.findUnique({
    where: { id: args.respondentId },
  });
  if (!respondent || respondent.deletedAt)
    return { ok: false, error: "Team member not found." };
  if (respondent.operatorId !== me.operatorId)
    return { ok: false, error: "Not your operator." };
  if (respondent.isOperatorAdmin)
    return {
      ok: false,
      error: "The Operator Admin's access can't be edited here.",
    };

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

  const operatorBuildingIds = new Set(
    operator.sites.flatMap((s) => s.buildings.map((b) => b.id))
  );
  for (const bid of args.buildingIds) {
    if (!operatorBuildingIds.has(bid))
      return { ok: false, error: "Unknown building." };
  }

  const buildingToInstance = new Map<string, string>();
  for (const s of operator.sites) {
    const inst = s.surveyInstances[0];
    if (!inst) continue;
    for (const b of s.buildings) buildingToInstance.set(b.id, inst.id);
  }

  const targetBuildingIds =
    args.buildingIds.length > 0
      ? args.buildingIds
      : Array.from(operatorBuildingIds);
  if (targetBuildingIds.length === 0)
    return { ok: false, error: "No buildings exist on this operator." };

  // Desired assignment key = instance|role|building (sectionId always "all").
  const desired = new Set<string>();
  for (const role of args.roles) {
    for (const buildingId of targetBuildingIds) {
      const instanceId = buildingToInstance.get(buildingId);
      if (!instanceId) continue;
      desired.add(`${instanceId}|${role}|${buildingId}`);
    }
  }
  if (desired.size === 0)
    return { ok: false, error: "No survey instance for those buildings." };

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.assignment.findMany({
        where: {
          respondentId: respondent.id,
          surveyInstance: { site: { operatorId: me.operatorId } },
        },
      });
      const keyOf = (a: { surveyInstanceId: string; role: string; buildingId: string | null }) =>
        `${a.surveyInstanceId}|${a.role}|${a.buildingId ?? ""}`;

      // Create the newly-wanted assignments.
      const survivors: string[] = [];
      for (const a of existing) {
        if (desired.has(keyOf(a))) survivors.push(a.id);
      }
      for (const key of desired) {
        const [surveyInstanceId, role, buildingId] = key.split("|");
        if (existing.some((a) => keyOf(a) === key)) continue;
        const created = await tx.assignment.create({
          data: {
            surveyInstanceId,
            respondentId: respondent.id,
            role,
            sectionId: "all",
            buildingId,
          },
        });
        survivors.push(created.id);
      }

      const toDelete = existing.filter((a) => !desired.has(keyOf(a)));
      if (toDelete.length > 0 && survivors.length > 0) {
        // Repoint any invitations off the doomed assignments first — the FK
        // would otherwise block the delete.
        await tx.invitation.updateMany({
          where: { assignmentId: { in: toDelete.map((a) => a.id) } },
          data: { assignmentId: survivors[0] },
        });
        await tx.assignment.deleteMany({
          where: { id: { in: toDelete.map((a) => a.id) } },
        });
      }
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Update failed.",
    };
  }

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "respondent.rolesUpdated",
    targetType: "Respondent",
    targetId: respondent.id,
    payload: { roles: args.roles, buildingIds: targetBuildingIds },
  });

  return { ok: true };
}

/**
 * Remove a team member from the operator's survey — soft-delete. Their
 * answers stay (they're part of the survey record); their sessions and
 * invitations are expired so they can no longer sign in.
 */
export async function removeRespondent(
  respondentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireOperatorAdmin();

  const respondent = await db.respondent.findUnique({
    where: { id: respondentId },
  });
  if (!respondent || respondent.deletedAt)
    return { ok: false, error: "Team member not found." };
  if (respondent.operatorId !== me.operatorId)
    return { ok: false, error: "Not your operator." };
  if (respondent.isOperatorAdmin)
    return { ok: false, error: "Operator Admins can't be removed here." };
  if (respondent.id === me.respondentId)
    return { ok: false, error: "You can't remove yourself." };

  const now = new Date();
  const epoch = new Date(0);
  await db.$transaction([
    db.respondent.update({
      where: { id: respondentId },
      data: { deletedAt: now },
    }),
    db.session.updateMany({
      where: { respondentId, expiresAt: { gt: now } },
      data: { expiresAt: epoch },
    }),
    db.invitation.updateMany({
      where: { expiresAt: { gt: now }, assignment: { respondentId } },
      data: { expiresAt: epoch, boundSessionId: null },
    }),
  ]);

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "respondent.removed",
    targetType: "Respondent",
    targetId: respondentId,
    payload: { email: respondent.email },
  });

  return { ok: true };
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
