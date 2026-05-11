"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowRight, Bookmark, Check, CircleCheck, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  formSpec as defaultFormSpec,
  findGroupRef,
  getGroup,
  isLastGroup,
  nextGroupRef,
  prevGroupRef,
  getAllGroups,
} from "@/lib/form-data";
import { isQuestionVisible } from "@/lib/conditions";
import type { AnswerValue, FormSpec } from "@/lib/schema";
import { ProgressStrip } from "./ProgressStrip";
import { SectionNav } from "./SectionNav";
import { MobileNav } from "./MobileNav";
import { QuestionRenderer } from "./QuestionRenderer";
import { useFormBackend } from "./state-context";

interface WizardProps {
  /** Optional override: a scope-filtered template for the respondent-mode runner. */
  formSpec?: FormSpec;
  /** Base path for nav (default "/" for demo; "/survey/<id>" for DB runner). */
  basePath?: string;
  /** Where Save-for-later sends the user (default "/saved"). */
  savedPath?: string;
  /** Where Review/Submit sends the user (default "/review"). */
  reviewPath?: string;
}

export function Wizard({
  formSpec: formSpecProp,
  basePath = "/",
  savedPath = "/saved",
  reviewPath = "/review",
}: WizardProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAdded = searchParams.get("showAdded") === "true";

  const spec = formSpecProp ?? defaultFormSpec;

  const sectionId = searchParams.get("section") ?? spec.sections[0].id;
  const sectionFallbackGroup =
    spec.sections.find((s) => s.id === sectionId)?.groups[0]?.id ??
    spec.sections[0].groups[0].id;
  const groupId = searchParams.get("group") ?? sectionFallbackGroup;

  const groupRef = findGroupRef(sectionId, groupId, spec);
  const ctx = groupRef ? getGroup(sectionId, groupId, spec) : undefined;

  const {
    answers,
    saveState,
    submittedSections,
    setAnswer,
    clearAnswer,
    markSectionSubmitted,
  } = useFormBackend();

  const visibleQuestions = useMemo(() => {
    if (!ctx) return [];
    return ctx.group.questions.filter((q) => isQuestionVisible(q, answers));
  }, [ctx, answers]);

  if (!groupRef || !ctx) {
    return <div className="p-12 text-center text-muted">Section not found.</div>;
  }

  const { section, group } = ctx;
  const isFirstGroupOfSection = section.groups[0].id === group.id;

  // Pagination position: which page in this section, of how many.
  const groupsInSection = section.groups;
  const pageIndex = groupsInSection.findIndex((g) => g.id === group.id) + 1;
  const totalPagesInSection = groupsInSection.length;

  // Total instance pagination across all sections.
  const allGroups = getAllGroups(spec);
  const overallIndex = allGroups.findIndex(
    (r) => r.sectionId === section.id && r.groupId === group.id
  );

  const setValueWithCleanup = (id: string, v: AnswerValue) => {
    setAnswer(id, v);
    // Clear hidden questions whose `showWhen` no longer holds.
    const nextAnswers = { ...answers, [id]: v };
    for (const q of group.questions) {
      if (!isQuestionVisible(q, nextAnswers) && answers[q.id] !== undefined) {
        clearAnswer(q.id);
      }
    }
  };

  const navTo = (
    nextSectionId: string,
    nextGroupId: string,
    options?: { scrollTop?: boolean }
  ) => {
    const qs = new URLSearchParams();
    qs.set("section", nextSectionId);
    qs.set("group", nextGroupId);
    if (showAdded) qs.set("showAdded", "true");
    router.push(`${basePath}?${qs.toString()}`);
    if (options?.scrollTop !== false) {
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }
  };

  // Last page in this section? Determines whether Next becomes Submit-section.
  const isLastGroupOfSection =
    section.groups[section.groups.length - 1].id === group.id;
  const isLastSection =
    spec.sections[spec.sections.length - 1].id === section.id;

  const onNext = () => {
    if (isLastGroup(groupRef, spec)) {
      const qs = new URLSearchParams();
      if (showAdded) qs.set("showAdded", "true");
      router.push(`${reviewPath}${qs.toString() ? `?${qs.toString()}` : ""}`);
      return;
    }
    const next = nextGroupRef(groupRef, spec);
    if (next) navTo(next.sectionId, next.groupId);
  };

  const onSubmitSection = () => {
    markSectionSubmitted(section.id);
    if (isLastSection) {
      const qs = new URLSearchParams();
      if (showAdded) qs.set("showAdded", "true");
      router.push(`${reviewPath}${qs.toString() ? `?${qs.toString()}` : ""}`);
      return;
    }
    // Jump to first group of next section.
    const sectionIdx = spec.sections.findIndex((s) => s.id === section.id);
    const nextSection = spec.sections[sectionIdx + 1];
    if (nextSection) navTo(nextSection.id, nextSection.groups[0].id);
  };

  const onSaveForLater = () => {
    const qs = new URLSearchParams();
    qs.set("section", section.id);
    qs.set("group", group.id);
    if (showAdded) qs.set("showAdded", "true");
    router.push(`${savedPath}?${qs.toString()}`);
  };

  const onBack = () => {
    const prev = prevGroupRef(groupRef, spec);
    if (prev) navTo(prev.sectionId, prev.groupId);
  };

  return (
    <div>
      <ProgressStrip
        currentSectionIndex={groupRef.sectionIndex}
        spec={spec}
      />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[260px_1fr] md:py-10">
        <aside className="hidden md:block">
          <div className="sticky top-6">
            <SectionNav
              currentGroupId={group.id}
              currentSectionId={section.id}
              spec={spec}
              basePath={basePath}
            />
          </div>
        </aside>

        <main className="space-y-6">
          <MobileNav
            section={section}
            currentSectionId={section.id}
            currentGroupId={group.id}
            spec={spec}
            basePath={basePath}
          />

          <header>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-xs uppercase tracking-wide text-muted">
                Section {groupRef.sectionIndex + 1} of {spec.sections.length}{" "}
                · {section.title} · page {pageIndex} of {totalPagesInSection}
                {overallIndex >= 0 && (
                  <span className="ml-2 text-muted/60">
                    (overall {overallIndex + 1}/{allGroups.length})
                  </span>
                )}
              </p>
              <SaveIndicator state={saveState} />
            </div>
            {isFirstGroupOfSection && (
              <>
                <h1 className="mt-2 font-display text-3xl text-ink sm:text-[34px]">
                  {section.title}
                </h1>
                {section.intro && (
                  <p className="mt-3 max-w-prose text-muted">{section.intro}</p>
                )}
              </>
            )}
            {group.title && (
              <h2
                className={
                  isFirstGroupOfSection
                    ? "mt-6 font-display text-xl text-ink"
                    : "mt-2 font-display text-2xl text-ink"
                }
              >
                {group.title}
              </h2>
            )}
          </header>

          <Card className="divide-y divide-line">
            {visibleQuestions.map((q, i) => (
              <div key={q.id} className="px-6 py-6">
                <QuestionRenderer
                  question={q}
                  scope={answers}
                  getValue={(id) => answers[id]}
                  setValue={setValueWithCleanup}
                  index={i + 1}
                />
              </div>
            ))}
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={onBack}
                disabled={!prevGroupRef(groupRef, spec)}
              >
                Back
              </Button>
              <Button variant="ghost" onClick={onSaveForLater}>
                <Bookmark className="h-4 w-4" />
                Save for later
              </Button>
            </div>
            {isLastGroupOfSection ? (
              <Button onClick={onSubmitSection} size="lg">
                <CircleCheck className="h-4 w-4" />
                Submit{" "}
                <span className="hidden sm:inline">
                  Section {groupRef.sectionIndex + 1}: {section.title}
                </span>
                <span className="sm:hidden">this section</span>
              </Button>
            ) : (
              <Button onClick={onNext} size="lg">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {submittedSections[section.id] && !isLastGroupOfSection && (
            <p className="pt-1 text-xs text-muted">
              <CircleCheck className="mr-1 inline-block h-3 w-3 align-text-bottom text-accent" />
              You've previously submitted this section — your edits will
              update the record on the next submit.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

function SaveIndicator({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  if (state === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      {state === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3 w-3 text-accent" />
          Saved
        </>
      )}
      {state === "error" && (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <AlertCircle className="h-3 w-3" />
          Save failed — retrying…
        </span>
      )}
    </span>
  );
}
