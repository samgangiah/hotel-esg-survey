"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendInvitationEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/admin-auth";

interface AddOperatorArgs {
  operatorName: string;
  siteName: string;
  address: string | null;
  buildingNames: string[];
  adminName: string;
  adminEmail: string;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function addOperator(
  args: AddOperatorArgs
): Promise<{ ok: true; operatorId: string } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();

  if (!args.operatorName) return { ok: false, error: "Operator name required." };
  if (!args.siteName) return { ok: false, error: "Site name required." };
  if (args.buildingNames.length === 0)
    return { ok: false, error: "At least one building required." };
  if (!args.adminName) return { ok: false, error: "Operator Admin name required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.adminEmail))
    return { ok: false, error: "Operator Admin email looks invalid." };

  const template = await db.surveyTemplate.findFirst({
    where: { slug: "hotel-energy" },
    orderBy: { version: "desc" },
  });
  if (!template) {
    return {
      ok: false,
      error: "No survey template seeded yet — run `node scripts/seed.cjs`.",
    };
  }

  const result = await db.$transaction(async (tx) => {
    const operator = await tx.operator.create({
      data: { name: args.operatorName },
    });

    const site = await tx.site.create({
      data: {
        operatorId: operator.id,
        name: args.siteName,
        address: args.address,
      },
    });

    const buildings = await Promise.all(
      args.buildingNames.map((name) =>
        tx.building.create({
          data: { siteId: site.id, name },
        })
      )
    );

    await tx.site.update({
      where: { id: site.id },
      data: { primaryBuildingId: buildings[0].id },
    });

    const respondent = await tx.respondent.create({
      data: {
        operatorId: operator.id,
        email: args.adminEmail,
        name: args.adminName,
        isOperatorAdmin: true,
      },
    });

    const surveyInstance = await tx.surveyInstance.create({
      data: {
        siteId: site.id,
        templateId: template.id,
        status: "in_progress",
        windowOpensAt: new Date(),
      },
    });

    const assignment = await tx.assignment.create({
      data: {
        surveyInstanceId: surveyInstance.id,
        respondentId: respondent.id,
        role: "gm",
        sectionId: "all",
        buildingId: null,
      },
    });

    const { token, hash } = newToken();
    const invitation = await tx.invitation.create({
      data: {
        assignmentId: assignment.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
      },
    });

    return { operator, site, buildings, respondent, surveyInstance, assignment, invitation, token };
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/r/${result.token}`;
  await sendInvitationEmail({
    to: args.adminEmail,
    toName: args.adminName,
    magicLink,
    siteName: args.siteName,
    inviterName: me.name,
    roleLabel: "Operator Admin (full survey access)",
  });

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "operator.added",
    targetType: "Operator",
    targetId: result.operator.id,
    payload: {
      operatorName: args.operatorName,
      siteName: args.siteName,
      buildings: args.buildingNames,
      adminEmail: args.adminEmail,
    },
  });

  return { ok: true, operatorId: result.operator.id };
}
