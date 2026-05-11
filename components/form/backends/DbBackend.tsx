"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FormBackendContext,
  type FormBackend,
  type SaveState,
} from "../state-context";
import type { AnswerValue, Answers } from "@/lib/schema";
import { saveAnswer, submitSection } from "./db-actions";

/**
 * DB-backed form backend used by /survey/[instanceId].
 *
 * - Holds optimistic React state for answers.
 * - Debounces server writes by 400ms so typing-heavy inputs don't fire a
 *   round-trip on every keystroke (per-question debounce).
 * - Mirrors save-state UX from the demo: idle → saving → saved → idle.
 * - Cross-device resume comes from the server sending the latest answers down
 *   on initial render; this component just keeps them up to date.
 */
export function DbFormBackendProvider({
  instanceId,
  initialAnswers,
  initialSubmittedSections,
  children,
}: {
  instanceId: string;
  initialAnswers: Answers;
  initialSubmittedSections: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [submittedSections, setSubmittedSections] = useState<
    Record<string, boolean>
  >(initialSubmittedSections);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Per-question debounce timers so each field flushes independently.
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const inFlight = useRef<number>(0);

  const flush = useCallback(
    async (id: string, value: AnswerValue) => {
      inFlight.current += 1;
      setSaveState("saving");
      const result = await saveAnswer({
        instanceId,
        questionId: id,
        value,
      });
      inFlight.current -= 1;
      if (!result.ok) {
        setSaveState("error");
        // Surface the error in the console for now; the UI shows "Save failed".
        // eslint-disable-next-line no-console
        console.error("[saveAnswer]", id, result.error);
        return;
      }
      if (inFlight.current === 0) setSaveState("saved");
    },
    [instanceId]
  );

  const scheduleFlush = useCallback(
    (id: string, value: AnswerValue) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timers.current.delete(id);
        void flush(id, value);
      }, 400);
      timers.current.set(id, t);
    },
    [flush]
  );

  // When we settle on "saved" briefly, fade back to idle.
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1800);
    return () => clearTimeout(t);
  }, [saveState]);

  const setAnswerLocal = useCallback(
    (id: string, value: AnswerValue) => {
      setAnswers((prev) => ({ ...prev, [id]: value }));
      scheduleFlush(id, value);
    },
    [scheduleFlush]
  );

  const clearAnswerLocal = useCallback(
    (id: string) => {
      setAnswers((prev) => {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      });
      scheduleFlush(id, undefined);
    },
    [scheduleFlush]
  );

  const markSectionSubmittedLocal = useCallback(
    async (sectionId: string) => {
      // Optimistic update; reconcile if server rejects.
      setSubmittedSections((prev) => ({ ...prev, [sectionId]: true }));
      const result = await submitSection({ instanceId, sectionId });
      if (!result.ok) {
        setSubmittedSections((prev) => ({ ...prev, [sectionId]: false }));
        // eslint-disable-next-line no-console
        console.error("[submitSection]", sectionId, result.error);
      }
    },
    [instanceId]
  );

  const backend: FormBackend = useMemo(
    () => ({
      answers,
      submittedSections,
      saveState,
      mode: "db",
      instanceId,
      setAnswer: setAnswerLocal,
      clearAnswer: clearAnswerLocal,
      markSectionSubmitted: markSectionSubmittedLocal,
    }),
    [
      answers,
      submittedSections,
      saveState,
      instanceId,
      setAnswerLocal,
      clearAnswerLocal,
      markSectionSubmittedLocal,
    ]
  );

  return (
    <FormBackendContext.Provider value={backend}>
      {children}
    </FormBackendContext.Provider>
  );
}
