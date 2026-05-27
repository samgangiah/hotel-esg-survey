/**
 * Pure helpers for question delegation. The persistence + email layer
 * lives in app/operator/delegate/actions.ts and app/d/[token]/...; this
 * file just has reusable shape definitions and lookup utilities so the
 * survey UI and the public delegate page can share types.
 */

import type { FormSpec, Question } from "@/lib/schema";

export interface DelegationState {
  id: string;
  questionId: string;
  delegatedToEmail: string;
  delegatedToName: string | null;
  delegatedByName: string;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  answeredAt: string | null;
  cancelledAt: string | null;
  /** Latest answered descendant — present once the chain has resolved. */
  finalAnswerByEmail: string | null;
  /** True iff a non-cancelled, non-answered delegation in the chain is still open. */
  awaitingAnswer: boolean;
  /** Depth of the chain (1 = originally delegated, 2 = forwarded once, etc). */
  chainDepth: number;
}

/**
 * Walk the locked FormSpec to find a question by id, including sub-questions
 * inside repeaters. Returns the question + section + group context so the
 * delegation email can show the right context to the delegate.
 */
export function findQuestionContext(
  spec: FormSpec,
  questionId: string
): { question: Question; sectionTitle: string; groupTitle: string | null } | null {
  for (const section of spec.sections) {
    for (const group of section.groups) {
      for (const q of group.questions) {
        if (q.id === questionId) {
          return {
            question: q,
            sectionTitle: section.title,
            groupTitle: group.title ?? null,
          };
        }
        if (q.subQuestions) {
          const sub = q.subQuestions.find((sq) => sq.id === questionId);
          if (sub) {
            return {
              question: sub,
              sectionTitle: section.title,
              groupTitle: group.title ?? null,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Locate a question within the section/group hierarchy. Used by email
 * URL builders to construct a deep link that lands the delegator
 * directly on the answered question rather than at the survey cover.
 *
 * Repeater sub-questions return the *parent's* group context — that's
 * what the URL needs (you navigate to the repeater, the parent renders,
 * the sub-question is inside it).
 */
export function findQuestionLocation(
  spec: FormSpec,
  questionId: string
): { sectionId: string; groupId: string } | null {
  for (const section of spec.sections) {
    for (const group of section.groups) {
      for (const q of group.questions) {
        if (q.id === questionId) {
          return { sectionId: section.id, groupId: group.id };
        }
        if (q.subQuestions?.some((sq) => sq.id === questionId)) {
          return { sectionId: section.id, groupId: group.id };
        }
      }
    }
  }
  return null;
}

/**
 * Build a deep link to a specific question in the survey, of the form
 *   /survey/<instanceId>?section=<sec>&group=<grp>#q-<questionId>
 *
 * Falls back to the bare survey URL if the question can't be located
 * (template drift, sub-question edge cases). The hash is consumed by
 * QuestionRenderer's scroll-into-view + flash-highlight effect.
 */
export function buildQuestionDeepLink(
  appUrl: string,
  instanceId: string,
  spec: FormSpec,
  questionId: string
): string {
  const loc = findQuestionLocation(spec, questionId);
  if (!loc) return `${appUrl}/survey/${instanceId}`;
  const qs = new URLSearchParams({
    section: loc.sectionId,
    group: loc.groupId,
  });
  return `${appUrl}/survey/${instanceId}?${qs.toString()}#q-${questionId}`;
}

/** 14-day expiry, same default as Invitations. */
export const DELEGATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
