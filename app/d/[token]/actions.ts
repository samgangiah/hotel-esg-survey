"use server";

import { db } from "@/lib/db";
import { newToken, hashToken } from "@/lib/auth/tokens";
import { audit } from "@/lib/audit";
import {
  sendDelegationEmail,
  sendDelegationCompletedEmail,
} from "@/lib/mailer";
import {
  DELEGATION_TTL_MS,
  findQuestionContext,
} from "@/lib/delegation";
import type { AnswerValue, FormSpec } from "@/lib/schema";
import type { Prisma } from "@prisma/client";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolve an open delegation by its public token. No respondent auth — the
 * token IS the auth. Used by both the page load and the submit action.
 */
type ResolvedDelegation =
  | { error: string }
  | { delegation: Awaited<ReturnType<typeof db.questionDelegation.findUnique>> & object };

async function resolveDelegation(token: string): Promise<ResolvedDelegation> {
  const tokenHash = hashToken(token);
  const delegation = await db.questionDelegation.findUnique({
    where: { tokenHash },
  });
  if (!delegation) return { error: "Link not found." };
  if (delegation.cancelledAt)
    return { error: "This delegation has been cancelled." };
  if (delegation.answeredAt)
    return { error: "This question has already been answered." };
  if (delegation.expiresAt < new Date()) return { error: "This link has expired." };
  return { delegation };
}

/**
 * Bob submits the answer to a delegated question. The delegation token IS
 * the auth — anyone holding the link can submit, exactly once. We:
 *   - create or upsert a Respondent for the delegate's email (so we can
 *     attribute the Answer row to a real person)
 *   - write the Answer row, anchored to the building captured at delegation
 *     time
 *   - mark the delegation answeredAt
 *   - notify the original delegator via email
 */
export async function submitDelegatedAnswer(args: {
  token: string;
  value: AnswerValue;
  delegateName?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await resolveDelegation(args.token);
    if ("error" in r) return { ok: false, error: r.error };
    const delegation = r.delegation;

    const instance = await db.surveyInstance.findUnique({
      where: { id: delegation.surveyInstanceId },
      include: {
        template: true,
        site: { include: { operator: true } },
      },
    });
    if (!instance) return { ok: false, error: "Survey not found." };
    if (instance.status === "submitted" || instance.status === "locked") {
      return { ok: false, error: "Survey is closed — can't submit." };
    }

    const spec = instance.template.schemaJson as unknown as FormSpec;
    const ctx = findQuestionContext(spec, delegation.questionId);
    if (!ctx) return { ok: false, error: "Question gone from template." };

    // Materialise the delegate as a Respondent in the operator's tenant so
    // the Answer row has a real attribution. The delegate has no Assignment
    // — they can't log in to /survey — but they DO appear in exports.
    const respondent = await db.respondent.upsert({
      where: {
        operatorId_email: {
          operatorId: instance.site.operator.id,
          email: delegation.delegatedToEmail,
        },
      },
      update: {
        name:
          delegation.delegatedToName ??
          (args.delegateName?.trim() || delegation.delegatedToEmail),
      },
      create: {
        operatorId: instance.site.operator.id,
        email: delegation.delegatedToEmail,
        name:
          delegation.delegatedToName ??
          (args.delegateName?.trim() || delegation.delegatedToEmail),
        isOperatorAdmin: false,
      },
    });

    // Write the answer. Same upsert shape as saveAnswer in db-actions.ts.
    const isEmpty =
      args.value === undefined ||
      args.value === null ||
      args.value === "" ||
      (Array.isArray(args.value) && args.value.length === 0);

    if (isEmpty) {
      return { ok: false, error: "Please give an answer before submitting." };
    }

    await db.answer.upsert({
      where: {
        surveyInstanceId_questionId_buildingId: {
          surveyInstanceId: delegation.surveyInstanceId,
          questionId: delegation.questionId,
          buildingId: delegation.buildingId,
        },
      },
      update: {
        valueJson: args.value as unknown as Prisma.InputJsonValue,
        respondentId: respondent.id,
      },
      create: {
        surveyInstanceId: delegation.surveyInstanceId,
        questionId: delegation.questionId,
        buildingId: delegation.buildingId,
        respondentId: respondent.id,
        valueJson: args.value as unknown as Prisma.InputJsonValue,
      },
    });

    await db.questionDelegation.update({
      where: { id: delegation.id },
      data: {
        answeredAt: new Date(),
        delegatedToRespondentId: respondent.id,
      },
    });

    await audit({
      actorType: "respondent",
      actorId: respondent.id,
      action: "question.delegationAnswered",
      targetType: "QuestionDelegation",
      targetId: delegation.id,
      payload: {
        questionId: delegation.questionId,
        delegateEmail: respondent.email,
      },
    });

    // Notify the original delegator (or the most recent forwarder).
    const delegator = await db.respondent.findUnique({
      where: { id: delegation.delegatedByRespondentId },
    });
    if (delegator) {
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      await sendDelegationCompletedEmail({
        to: delegator.email,
        toName: delegator.name,
        delegateEmail: respondent.email,
        questionLabel: ctx.question.label,
        siteName: instance.site.name,
        surveyUrl: `${appUrl}/survey/${instance.id}`,
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/**
 * The delegate forwards the question on to someone else. Creates a new
 * QuestionDelegation row chained to the current one, sends the email, and
 * marks the current one as "forwarded" by linking the child via
 * parentDelegationId (the child carries the live token; the parent is
 * implicitly resolved via the child's answeredAt).
 */
export async function forwardDelegation(args: {
  token: string;
  toEmail: string;
  toName?: string;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await resolveDelegation(args.token);
    if ("error" in r) return { ok: false, error: r.error };
    const parent = r.delegation;

    const email = args.toEmail.trim().toLowerCase();
    if (!EMAIL_RX.test(email)) {
      return { ok: false, error: "Looks like an invalid email address." };
    }

    const instance = await db.surveyInstance.findUnique({
      where: { id: parent.surveyInstanceId },
      include: { template: true, site: true },
    });
    if (!instance) return { ok: false, error: "Survey not found." };

    const spec = instance.template.schemaJson as unknown as FormSpec;
    const ctx = findQuestionContext(spec, parent.questionId);
    if (!ctx) return { ok: false, error: "Question gone from template." };

    // Materialise the forwarder as a Respondent so we attribute the new
    // delegation row to a real person.
    const forwarder = await db.respondent.upsert({
      where: {
        operatorId_email: {
          operatorId: instance.site.operatorId,
          email: parent.delegatedToEmail,
        },
      },
      update: {},
      create: {
        operatorId: instance.site.operatorId,
        email: parent.delegatedToEmail,
        name: parent.delegatedToName ?? parent.delegatedToEmail,
        isOperatorAdmin: false,
      },
    });

    const { token, hash } = newToken();
    const child = await db.questionDelegation.create({
      data: {
        surveyInstanceId: parent.surveyInstanceId,
        questionId: parent.questionId,
        buildingId: parent.buildingId,
        delegatedByRespondentId: forwarder.id,
        delegatedToEmail: email,
        delegatedToName: args.toName?.trim() || null,
        tokenHash: hash,
        note: args.note?.trim() || null,
        expiresAt: new Date(Date.now() + DELEGATION_TTL_MS),
        parentDelegationId: parent.id,
      },
    });

    // The parent is implicitly retired by being chained to a child; we also
    // mark it cancelledAt so the question's "active delegation" lookup picks
    // up the new one.
    await db.questionDelegation.update({
      where: { id: parent.id },
      data: { cancelledAt: new Date(), delegatedToRespondentId: forwarder.id },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    await sendDelegationEmail({
      to: email,
      toName: args.toName?.trim() || null,
      magicLink: `${appUrl}/d/${token}`,
      delegatorName: forwarder.name,
      siteName: instance.site.name,
      questionLabel: ctx.question.label,
      note: args.note?.trim() || null,
    });

    await audit({
      actorType: "respondent",
      actorId: forwarder.id,
      action: "question.delegationForwarded",
      targetType: "QuestionDelegation",
      targetId: child.id,
      payload: {
        parentDelegationId: parent.id,
        questionId: parent.questionId,
        toEmail: email,
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
