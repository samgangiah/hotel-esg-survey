"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireRespondent } from "@/lib/respondent-auth";
import type { AnswerValue } from "@/lib/schema";

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

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "submit failed",
    };
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
