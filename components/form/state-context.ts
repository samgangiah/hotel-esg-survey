"use client";

import { createContext, useContext } from "react";
import type { AnswerValue, Answers } from "@/lib/schema";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Per-question delegation state surfaced to the renderer. Keyed by question
 * id. Each entry describes the currently-active delegation: who it was sent
 * to, whether it's answered, and the chain context.
 */
export interface DelegationView {
  id: string;
  delegatedToEmail: string;
  delegatedToName: string | null;
  delegatedByName: string;
  delegatedByEmail: string;
  /** Set when this delegation was created by forwarding a prior one. */
  forwardedFromEmail: string | null;
  answeredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

/**
 * Pluggable form backend — consumed by Wizard / SectionNav / Repeater.
 * Two implementations:
 *   - ZustandFormBackend (browser-only demo at /)
 *   - DbFormBackend     (server-action backed, used by /survey/[instanceId])
 */
export interface FormBackend {
  /** Current answers keyed by question id (or sub-question id for repeater items). */
  answers: Answers;
  /** Sections the respondent has hit "Submit this section" on. */
  submittedSections: Record<string, boolean>;
  /** "Saving…" → "Saved" indicator. */
  saveState: SaveState;
  /** Whether the storage is persistent across devices (DB) or local-only. */
  mode: "demo" | "db";
  /**
   * SurveyInstance id for DB mode (needed by file uploads). Null in demo mode
   * — the FileInput renders an offline-only stub when null.
   */
  instanceId: string | null;
  /**
   * Active delegations keyed by question id. Set in DB mode; empty in demo.
   * QuestionRenderer reads from this to decide whether to render the input,
   * a "waiting on Bob" pill, or a "Bob answered" read-only view.
   */
  delegations: Record<string, DelegationView>;
  /** True if the current respondent is allowed to delegate (i.e. signed in). */
  canDelegate: boolean;

  setAnswer: (id: string, value: AnswerValue) => void;
  clearAnswer: (id: string) => void;

  markSectionSubmitted: (sectionId: string) => void;
}

export const FormBackendContext = createContext<FormBackend | null>(null);

export function useFormBackend(): FormBackend {
  const ctx = useContext(FormBackendContext);
  if (!ctx) {
    throw new Error(
      "useFormBackend must be used inside a FormBackendContext.Provider"
    );
  }
  return ctx;
}

/**
 * Scope context for sub-questions rendered inside a repeater item.
 * FileInput consumes this so a file uploaded inside repeater item N records
 * `repeaterParentId` + `repeaterIndex` against the server-side row.
 * Outside a repeater this context is absent (default null).
 */
export interface RepeaterScope {
  parentQuestionId: string;
  index: number;
}

export const RepeaterScopeContext = createContext<RepeaterScope | null>(null);

export function useRepeaterScope(): RepeaterScope | null {
  return useContext(RepeaterScopeContext);
}
