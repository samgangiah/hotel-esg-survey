"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { sendInvitationEmail } from "@/lib/mailer";
import { audit } from "@/lib/audit";
import { requireOperator } from "@/lib/operator-auth";

interface AddClientArgs {
  organisationName: string;
  siteName: string;
  address: string | null;
  buildingNames: string[];
  adminName: string;
  adminEmail: string;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function addClient(
  args: AddClientArgs
): Promise<{ ok: true; siteId: string } | { ok: false; error: string }> {
  const op = await requireOperator();

  // Validation
  if (!args.organisationName) return { ok: false, error: "Organisation name required." };
  if (!args.siteName) return { ok: false, error: "Site name required." };
  if (args.buildingNames.length === 0)
    return { ok: false, error: "At least one building required." };
  if (!args.adminName) return { ok: false, error: "Site admin name required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.adminEmail))
    return { ok: false, error: "Site admin email looks invalid." };

  // Pick the latest hotel-energy template.
  const template = await db.surveyTemplate.findFirst({
    where: { slug: "hotel-energy" },
    orderBy: { version: "desc" },
  });
  if (!template) {
    return {
      ok: false,
      error: "No survey template seeded yet — run `npm run db:seed`.",
    };
  }

  // Atomic-ish creation. We use a transaction.
  const result = await db.$transaction(async (tx) => {
    const org = await tx.organisation.create({
      data: { name: args.organisationName },
    });

    // Create site without primaryBuildingId, then create buildings, then
    // backfill primaryBuildingId.
    const site = await tx.site.create({
      data: {
        organisationId: org.id,
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
        organisationId: org.id,
        email: args.adminEmail,
        name: args.adminName,
        isSiteAdmin: true,
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

    // Site Admin gets one catch-all assignment that lets them answer everything.
    // Phase 1 will refine this into per-section assignments.
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

    return { org, site, buildings, respondent, surveyInstance, assignment, invitation, token };
  });

  // Send invite (stubbed — logs the link).
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const magicLink = `${appUrl}/r/${result.token}`;
  await sendInvitationEmail({
    to: args.adminEmail,
    toName: args.adminName,
    magicLink,
    siteName: args.siteName,
    inviterName: op.name,
    roleLabel: "Site Admin (full survey access)",
  });

  await audit({
    actorType: "operator",
    actorId: op.operatorId,
    action: "client.added",
    targetType: "Site",
    targetId: result.site.id,
    payload: {
      organisationName: args.organisationName,
      buildings: args.buildingNames,
      adminEmail: args.adminEmail,
    },
  });

  return { ok: true, siteId: result.site.id };
}
