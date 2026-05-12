"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendWelcomeEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin } from "@/lib/admin-auth";

interface AddOperatorArgs {
  operatorName: string;
  adminName: string;
  adminEmail: string;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const PLACEHOLDER_SITE_NAME = "Your first hotel";
const PLACEHOLDER_BUILDING_NAME = "Main building";

/**
 * Skinny onboarding: SaaS admin only provides the operator (company) name +
 * the Operator Admin's name + email. Everything else — site name, address,
 * buildings — is filled in by the customer themselves the first time they
 * land in `/operator` (the setup wizard takes them through it).
 *
 * The schema still requires Operator → Site → SurveyInstance → Assignment →
 * Invitation, so we create those rows with placeholder names. The customer
 * renames the site as their first onboarding step; that flips
 * `Operator.setupCompletedAt`, the wizard collapses, and the dashboard
 * takes over.
 */
export async function addOperator(
  args: AddOperatorArgs
): Promise<{ ok: true; operatorId: string } | { ok: false; error: string }> {
  const me = await requirePlatformAdmin();

  if (!args.operatorName.trim())
    return { ok: false, error: "Operator name required." };
  if (!args.adminName.trim())
    return { ok: false, error: "Operator Admin name required." };
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
      data: { name: args.operatorName.trim(), setupCompletedAt: null },
    });

    const site = await tx.site.create({
      data: {
        operatorId: operator.id,
        name: PLACEHOLDER_SITE_NAME,
        address: null,
      },
    });

    const building = await tx.building.create({
      data: { siteId: site.id, name: PLACEHOLDER_BUILDING_NAME },
    });

    await tx.site.update({
      where: { id: site.id },
      data: { primaryBuildingId: building.id },
    });

    const respondent = await tx.respondent.create({
      data: {
        operatorId: operator.id,
        email: args.adminEmail.trim().toLowerCase(),
        name: args.adminName.trim(),
        isOperatorAdmin: true,
      },
    });

    const surveyInstance = await tx.surveyInstance.create({
      data: {
        siteId: site.id,
        templateId: template.id,
        status: "draft",
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
    await tx.invitation.create({
      data: {
        assignmentId: assignment.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
      },
    });

    return { operator, respondent, token };
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/r/${result.token}`;
  await sendWelcomeEmail({
    to: result.respondent.email,
    toName: result.respondent.name,
    magicLink,
    operatorName: result.operator.name,
    inviterName: me.name,
  });

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "operator.added",
    targetType: "Operator",
    targetId: result.operator.id,
    payload: {
      operatorName: args.operatorName,
      adminEmail: args.adminEmail,
      welcomeEmail: true,
    },
  });

  return { ok: true, operatorId: result.operator.id };
}
