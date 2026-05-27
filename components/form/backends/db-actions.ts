"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRespondent } from "@/lib/respondent-auth";
import { newToken } from "@/lib/auth/tokens";
import {
  sendSectionSubmittedEmail,
  sendAllSectionsCompleteEmail,
} from "@/lib/mailer";
import type { AnswerValue, FormSpec } from "@/lib/schema";

/** 14-day expiry, matches the rest of the app. */
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Mint a fresh magic-link URL for the given respondent against the given
 * SurveyInstance, with `nextPath` set so the click lands on a specific
 * destination after identity confirmation. Returns a fully-qualified URL
 * like `${APP_URL}/r/<token>`, or null if the respondent has no assignment
 * on that instance (shouldn't happen for OAs but we guard anyway).
 *
 * Used by the section-submitted + all-sections-complete notification flow
 * so that Operator Admins clicking from email don't get stuck inside
 * another team-member's session on the same device.
 */
async function mintMagicLinkUrl(args: {
  respondentId: string;
  instanceId: string;
  nextPath: string;
}): Promise<string | null> {
  const assignment = await db.assignment.findFirst({
    where: {
      respondentId: args.respondentId,
      surveyInstanceId: args.instanceId,
    },
    select: { id: true },
  });
  if (!assignment) return null;

  const { token, hash } = newToken();
  await db.invitation.create({
    data: {
      assignmentId: assignment.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
      nextPath: args.nextPath,
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/r/${token}`;
}

/**
 * Verify the active respondent has an assignment to this instance, and resolve
 * the anchor `buildingId` for answer storage:
 *   - if scoped to a specific building, use it
 *   - if scoped "all" (Operator Admin), use site.primaryBuildingId
 *   - else fall back to the first building on the site
 *
 * Returns { instance, anchorBuildingId } or throws.
 */
async function authoriseInstance(instanceId: string) {
  const me = await requireRespondent();
  const instance = await db.surveyInstance.findFirst({
    where: {
      id: instanceId,
      assignments: { some: { respondentId: me.respondentId } },
    },
    include: {
      site: { include: { buildings: { where: { deletedAt: null } } } },
      assignments: { where: { respondentId: me.respondentId } },
    },
  });
  if (!instance) throw new Error("Not authorised for this survey instance.");

  const myAssignments = instance.assignments;
  // Anchor for answers: respondent's first scoped building, or site primary.
  const scopedBuildingId =
    myAssignments.find((a) => a.buildingId !== null)?.buildingId ?? null;
  const anchorBuildingId =
    scopedBuildingId ??
    instance.site.primaryBuildingId ??
    instance.site.buildings[0]?.id ??
    null;
  if (!anchorBuildingId)
    throw new Error("Site has no buildings — cannot anchor answers.");

  return { me, instance, anchorBuildingId };
}

export async function saveAnswer(args: {
  instanceId: string;
  questionId: string;
  value: AnswerValue;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { me, instance, anchorBuildingId } = await authoriseInstance(
      args.instanceId
    );
    if (instance.status === "submitted" || instance.status === "locked") {
      return { ok: false, error: "Survey is closed — answers can no longer be edited." };
    }

    const isEmpty =
      args.value === undefined ||
      args.value === null ||
      args.value === "" ||
      (Array.isArray(args.value) && args.value.length === 0);

    if (isEmpty) {
      await db.answer.deleteMany({
        where: {
          surveyInstanceId: instance.id,
          questionId: args.questionId,
          buildingId: anchorBuildingId,
        },
      });
    } else {
      await db.answer.upsert({
        where: {
          surveyInstanceId_questionId_buildingId: {
            surveyInstanceId: instance.id,
            questionId: args.questionId,
            buildingId: anchorBuildingId,
          },
        },
        update: {
          // Prisma JSON write expects `Prisma.InputJsonValue`. AnswerValue is a
          // superset — cast at the boundary.
          valueJson: args.value as never,
          respondentId: me.respondentId,
        },
        create: {
          surveyInstanceId: instance.id,
          questionId: args.questionId,
          buildingId: anchorBuildingId,
          respondentId: me.respondentId,
          valueJson: args.value as never,
        },
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "save failed" };
  }
}

export async function submitSection(args: {
  instanceId: string;
  sectionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { me, instance } = await authoriseInstance(args.instanceId);
    if (instance.status === "submitted" || instance.status === "locked") {
      return { ok: false, error: "Survey is closed — cannot submit sections." };
    }

    await db.sectionSubmission.upsert({
      where: {
        surveyInstanceId_respondentId_sectionId: {
          surveyInstanceId: instance.id,
          respondentId: me.respondentId,
          sectionId: args.sectionId,
        },
      },
      update: { submittedAt: new Date() },
      create: {
        surveyInstanceId: instance.id,
        respondentId: me.respondentId,
        sectionId: args.sectionId,
      },
    });

    // Bump matching assignments to "submitted" for the progress grid.
    await db.assignment.updateMany({
      where: {
        surveyInstanceId: instance.id,
        respondentId: me.respondentId,
        OR: [{ sectionId: args.sectionId }, { sectionId: "all" }],
      },
      data: { status: "submitted" },
    });

    await audit({
      actorType: "respondent",
      actorId: me.respondentId,
      action: "section.submitted",
      targetType: "SurveyInstance",
      targetId: instance.id,
      payload: { sectionId: args.sectionId },
    });

    // Fire and forget — notify Operator Admins. Wrapped in try/catch so an
    // email-provider failure can't prevent the submission from being saved.
    try {
      await notifyOnSectionSubmitted({
        instanceId: instance.id,
        sectionId: args.sectionId,
        submitterRespondentId: me.respondentId,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[notifyOnSectionSubmitted]", e);
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "submit failed",
    };
  }
}

/**
 * After a section is submitted, notify the Operator Admin(s):
 *   - one "X submitted [section]" email per Operator Admin (skip the submitter
 *     themselves if they're also the OA)
 *   - if every section in the locked template now has at least one
 *     SectionSubmission, also send the "all sections complete" email
 *
 * Errors here never block the actual section submission — call site already
 * wraps in try/catch.
 */
async function notifyOnSectionSubmitted(args: {
  instanceId: string;
  sectionId: string;
  submitterRespondentId: string;
}) {
  const instance = await db.surveyInstance.findUnique({
    where: { id: args.instanceId },
    include: {
      template: true,
      site: { include: { operator: true } },
      sectionSubmissions: true,
    },
  });
  if (!instance) return;

  const submitter = await db.respondent.findUnique({
    where: { id: args.submitterRespondentId },
  });
  if (!submitter) return;

  const spec = instance.template.schemaJson as unknown as FormSpec;
  const sectionTitle =
    spec.sections.find((s) => s.id === args.sectionId)?.title ?? args.sectionId;

  // Operator Admins to notify (excluding the submitter themselves).
  const operatorAdmins = await db.respondent.findMany({
    where: {
      operatorId: instance.site.operatorId,
      isOperatorAdmin: true,
      deletedAt: null,
      emailInvalid: false,
      id: { not: args.submitterRespondentId },
    },
  });

  for (const oa of operatorAdmins) {
    // Mint a magic link that lands on /operator/progress after identity
    // confirmation. Falls back to the bare path if the OA has no
    // assignment on this instance (shouldn't happen, but defensive).
    const progressUrl =
      (await mintMagicLinkUrl({
        respondentId: oa.id,
        instanceId: instance.id,
        nextPath: "/operator/progress",
      })) ?? `${process.env.APP_URL ?? "http://localhost:3000"}/operator/progress`;

    await sendSectionSubmittedEmail({
      to: oa.email,
      toName: oa.name,
      submitterName: submitter.name,
      sectionTitle,
      siteName: instance.site.name,
      progressUrl,
    });
  }

  // All sections complete? Count distinct section ids in submissions and
  // compare to the template's section count.
  const submittedSectionIds = new Set(
    instance.sectionSubmissions.map((s) => s.sectionId)
  );
  const expectedSectionIds = new Set(spec.sections.map((s) => s.id));
  // Add the one we just submitted (the include above was captured pre-write
  // in this transaction window — handle that explicitly).
  submittedSectionIds.add(args.sectionId);

  const allComplete =
    expectedSectionIds.size > 0 &&
    Array.from(expectedSectionIds).every((id) => submittedSectionIds.has(id));

  if (allComplete) {
    await audit({
      actorType: "system",
      action: "instance.allSectionsComplete",
      targetType: "SurveyInstance",
      targetId: instance.id,
    });
    for (const oa of operatorAdmins) {
      const reviewUrl =
        (await mintMagicLinkUrl({
          respondentId: oa.id,
          instanceId: instance.id,
          nextPath: `/survey/${instance.id}/review`,
        })) ??
        `${process.env.APP_URL ?? "http://localhost:3000"}/survey/${instance.id}/review`;

      await sendAllSectionsCompleteEmail({
        to: oa.email,
        toName: oa.name,
        siteName: instance.site.name,
        operatorName: instance.site.operator.name,
        reviewUrl,
      });
    }
  }
}

export async function submitInstance(args: {
  instanceId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { me, instance } = await authoriseInstance(args.instanceId);
    // Only the Operator Admin can lock the whole instance.
    const meRow = await db.respondent.findUnique({
      where: { id: me.respondentId },
    });
    if (!meRow?.isOperatorAdmin) {
      return { ok: false, error: "Only the Operator Admin can submit the whole survey." };
    }

    await db.surveyInstance.update({
      where: { id: instance.id },
      data: { status: "submitted", lockedAt: new Date() },
    });

    await audit({
      actorType: "respondent",
      actorId: me.respondentId,
      action: "instance.submitted",
      targetType: "SurveyInstance",
      targetId: instance.id,
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "submit failed",
    };
  }
}
