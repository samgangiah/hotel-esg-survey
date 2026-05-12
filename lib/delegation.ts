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

/** 14-day expiry, same default as Invitations. */
export const DELEGATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
