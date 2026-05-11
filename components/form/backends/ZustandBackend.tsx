"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormStore } from "@/lib/store";
import {
  FormBackendContext,
  type FormBackend,
  type SaveState,
} from "../state-context";

/**
 * Zustand-backed (localStorage) backend for the demo at /.
 * No server round-trips; the "saving"/"saved" indicator is purely a UX hint.
 */
export function ZustandFormBackendProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const answers = useFormStore((s) => s.answers);
  const submittedSections = useFormStore((s) => s.submittedSections);
  const setAnswerInStore = useFormStore((s) => s.setAnswer);
  const clearAnswerInStore = useFormStore((s) => s.clearAnswer);
  const markSectionSubmittedInStore = useFormStore(
    (s) => s.markSectionSubmitted
  );

  // Save-state visual hint, triggered on every answers change.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    setSaveState("saving");
    const t1 = setTimeout(() => setSaveState("saved"), 250);
    const t2 = setTimeout(() => setSaveState("idle"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [answers]);

  const backend: FormBackend = useMemo(
    () => ({
      answers,
      submittedSections,
      saveState,
      mode: "demo",
      setAnswer: setAnswerInStore,
      clearAnswer: clearAnswerInStore,
      markSectionSubmitted: markSectionSubmittedInStore,
    }),
    [
      answers,
      submittedSections,
      saveState,
      setAnswerInStore,
      clearAnswerInStore,
      markSectionSubmittedInStore,
    ]
  );

  return (
    <FormBackendContext.Provider value={backend}>
      {children}
    </FormBackendContext.Provider>
  );
}
