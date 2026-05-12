"use server";

import { db } from "@/lib/db";
import { newToken } from "@/lib/auth/tokens";
import { audit } from "@/lib/audit";
import { requireRespondent } from "@/lib/respondent-auth";
import {
  sendDelegationEmail,
  sendDelegationCancelledEmail,
} from "@/lib/mailer";
import { DELEGATION_TTL_MS, findQuestionContext } from "@/lib/delegation";
import type { FormSpec } from "@/lib/schema";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Authorise the current respondent on this instance and resolve the anchor
 * building for the answer. Same logic as saveAnswer's authoriseInstance.
 */
async function authoriseInstance(instanceId: string) {
  const me = await requireRespondent();
  const instance = await db.surveyInstance.findFirst({
    where: {
      id: instanceId,
      assignments: { some: { respondentId: me.respondentId } },
    },
    include: {
      template: true,
      site: {
        include: {
          operator: true,
          buildings: { where: { deletedAt: null } },
        },
      },
      assignments: { where: { respondentId: me.respondentId } },
    },
  });
  if (!instance) throw new Error("Not authorised for this survey.");

  const scopedBuildingId =
    instance.assignments.find((a) => a.buildingId !== null)?.buildingId ?? null;
  const anchorBuildingId =
    scopedBuildingId ??
    instance.site.primaryBuildingId ??
    instance.site.buildings[0]?.id ??
    null;
  if (!anchorBuildingId) throw new Error("Site has no buildings.");

  return { me, instance, anchorBuildingId };
}

/**
 * Delegate a question to another email address. Any respondent who can see
 * the question can call this. Cancels any prior active delegation on the
 * same question first, then mints a fresh token + sends an email.
 */
export async function delegateQuestion(args: {
  instanceId: string;
  questionId: string;
  toEmail: string;
  toName?: string;
  note?: string;
  /** Set when this delegation is being forwarded by a previous delegate. */
  parentDelegationId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { me, instance, anchorBuildingId } = await authoriseInstance(
      args.instanceId
    );
    if (instance.status === "submitted" || instance.status === "locked") {
      return { ok: false, error: "Survey is closed — can't delegate." };
    }

    const email = args.toEmail.trim().toLowerCase();
    if (!EMAIL_RX.test(email)) {
      return { ok: false, error: "Looks like an invalid email address." };
    }

    const spec = instance.template.schemaJson as unknown as FormSpec;
    const ctx = findQuestionContext(spec, args.questionId);
    if (!ctx) {
      return { ok: false, error: "Question not found in this template." };
    }

    // Cancel any prior active delegation on this (instance, question, building).
    // Forwarding (parentDelegationId set) skips this — the parent stays as a
    // historical link.
    if (!args.parentDelegationId) {
      await db.questionDelegation.updateMany({
        where: {
          surveyInstanceId: instance.id,
          questionId: args.questionId,
          buildingId: anchorBuildingId,
          answeredAt: null,
          cancelledAt: null,
        },
        data: { cancelledAt: new Date() },
      });
    }

    const { token, hash } = newToken();
    const delegation = await db.questionDelegation.create({
      data: {
        surveyInstanceId: instance.id,
        questionId: args.questionId,
        buildingId: anchorBuildingId,
        delegatedByRespondentId: me.respondentId,
        delegatedToEmail: email,
        delegatedToName: args.toName?.trim() || null,
        tokenHash: hash,
        note: args.note?.trim() || null,
        expiresAt: new Date(Date.now() + DELEGATION_TTL_MS),
        parentDelegationId: args.parentDelegationId ?? null,
      },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    await sendDelegationEmail({
      to: email,
      toName: args.toName?.trim() || null,
      magicLink: `${appUrl}/d/${token}`,
      delegatorName: me.name,
      siteName: instance.site.name,
      questionLabel: ctx.question.label,
      note: args.note?.trim() || null,
    });

    await audit({
      actorType: "respondent",
      actorId: me.respondentId,
      action: "question.delegated",
      targetType: "QuestionDelegation",
      targetId: delegation.id,
      payload: {
        surveyInstanceId: instance.id,
        questionId: args.questionId,
        toEmail: email,
        forwarded: !!args.parentDelegationId,
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * Cancel an open delegation. Only the original delegator (or someone in the
 * delegation chain) can cancel — surfaced as a small "cancel" link on the
 * delegated-question UI in the survey.
 */
export async function cancelDelegation(
  delegationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const me = await requireRespondent();
    const delegation = await db.questionDelegation.findUnique({
      where: { id: delegationId },
    });
    if (!delegation) return { ok: false, error: "Delegation not found." };
    if (delegation.delegatedByRespondentId !== me.respondentId) {
      return { ok: false, error: "Only the delegator can cancel." };
    }
    if (delegation.answeredAt) {
      return { ok: false, error: "Already answered." };
    }
    if (delegation.cancelledAt) {
      return { ok: false, error: "Already cancelled." };
    }
    await db.questionDelegation.update({
      where: { id: delegationId },
      data: { cancelledAt: new Date() },
    });
    await audit({
      actorType: "respondent",
      actorId: me.respondentId,
      action: "question.delegationCancelled",
      targetType: "QuestionDelegation",
      targetId: delegationId,
    });

    // Notify the delegate that their link is no longer needed. Best-effort.
    try {
      const instance = await db.surveyInstance.findUnique({
        where: { id: delegation.surveyInstanceId },
        include: { template: true, site: true },
      });
      if (instance) {
        const spec = instance.template.schemaJson as unknown as FormSpec;
        const ctx = findQuestionContext(spec, delegation.questionId);
        if (ctx) {
          await sendDelegationCancelledEmail({
            to: delegation.delegatedToEmail,
            toName: delegation.delegatedToName,
            delegatorName: me.name,
            questionLabel: ctx.question.label,
            siteName: instance.site.name,
          });
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[sendDelegationCancelledEmail]", e);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
