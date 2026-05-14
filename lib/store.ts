"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Answers, AnswerValue, RepeaterItem } from "./schema";

interface FormStore {
  answers: Answers;
  attemptedAdvance: Record<string, boolean>; // groupId -> whether user tried to advance
  submittedSections: Record<string, boolean>; // sectionId -> submitted
  setAnswer: (id: string, value: AnswerValue) => void;
  clearAnswer: (id: string) => void;
  setRepeaterItem: (id: string, index: number, item: RepeaterItem) => void;
  setRepeaterCount: (id: string, count: number) => void;
  markAdvanceAttempted: (groupId: string) => void;
  markSectionSubmitted: (sectionId: string) => void;
  reset: () => void;
}

export const useFormStore = create<FormStore>()(
  persist(
    (set) => ({
      answers: {},
      attemptedAdvance: {},
      submittedSections: {},
      setAnswer: (id, value) =>
        set((s) => ({ answers: { ...s.answers, [id]: value } })),
      clearAnswer: (id) =>
        set((s) => {
          const { [id]: _drop, ...rest } = s.answers;
          return { answers: rest };
        }),
      setRepeaterItem: (id, index, item) =>
        set((s) => {
          const existing = (s.answers[id] as RepeaterItem[] | undefined) ?? [];
          const next = [...existing];
          next[index] = { ...next[index], ...item };
          return { answers: { ...s.answers, [id]: next } };
        }),
      setRepeaterCount: (id, count) =>
        set((s) => {
          const existing = (s.answers[id] as RepeaterItem[] | undefined) ?? [];
          const next: RepeaterItem[] = [];
          for (let i = 0; i < count; i++) next.push(existing[i] ?? {});
          return { answers: { ...s.answers, [id]: next } };
        }),
      markAdvanceAttempted: (groupId) =>
        set((s) => ({
          attemptedAdvance: { ...s.attemptedAdvance, [groupId]: true },
        })),
      markSectionSubmitted: (sectionId) =>
        set((s) => ({
          submittedSections: { ...s.submittedSections, [sectionId]: true },
        })),
      reset: () =>
        set({ answers: {}, attemptedAdvance: {}, submittedSections: {} }),
    }),
    {
      name: "phs-energy-demo",
      // v0.4: localStorage (was sessionStorage) so close-tab → reopen the
      // original link on the same device restores progress. Penny's tested
      // scenario from 2026-05-11.
      //
      // True cross-device resume (open the link on your home laptop after
      // filling in part on your work laptop) lands when the DB-backed survey
      // runner ships in Phase 0.F.2.
      storage:
        typeof window !== "undefined"
          ? createJSONStorage(() => localStorage)
          : undefined,
      // Don't persist files — they're not serialisable. We only persist scalar/array fields.
      partialize: (s) => ({
        answers: stripFiles(s.answers),
        attemptedAdvance: s.attemptedAdvance,
        submittedSections: s.submittedSections,
      }),
    }
  )
);

function stripFiles(answers: Answers): Answers {
  const out: Answers = {};
  for (const [k, v] of Object.entries(answers)) {
    if (Array.isArray(v) && v.length > 0 && isFileLike(v[0])) {
      // keep file metadata only
      out[k] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isFileLike(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    "name" in (v as Record<string, unknown>) &&
    "size" in (v as Record<string, unknown>)
  );
}
