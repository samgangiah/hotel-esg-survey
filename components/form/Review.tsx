"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useFormStore } from "@/lib/store";
import { formSpec } from "@/lib/form-data";
import { isQuestionVisible } from "@/lib/conditions";
import type {
  Answers,
  AnswerValue,
  Question,
  RepeaterItem,
  Section,
  StoredFile,
} from "@/lib/schema";

export function Review() {
  const router = useRouter();
  const params = useSearchParams();
  const showAdded = params.get("showAdded") === "true";
  const answers = useFormStore((s) => s.answers);

  const onSubmit = () => {
    const qs = new URLSearchParams();
    if (showAdded) qs.set("showAdded", "true");
    router.push(`/done${qs.toString() ? `?${qs.toString()}` : ""}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">
          Review your answers
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink">
          Almost done — please review
        </h1>
        <p className="mt-3 text-muted">
          Have a quick scan over what you've told us. You can jump back to any
          section to edit.
        </p>
      </div>

      <div className="space-y-8">
        {formSpec.sections.map((section) => (
          <SectionReview
            key={section.id}
            section={section}
            answers={answers}
            showAdded={showAdded}
          />
        ))}
      </div>

      <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/?${showAdded ? "showAdded=true" : ""}`}
          className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          ← Back to the form
        </Link>
        <Button size="lg" onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}

function SectionReview({
  section,
  answers,
  showAdded,
}: {
  section: Section;
  answers: Answers;
  showAdded: boolean;
}) {
  const editHref = `/?section=${section.id}&group=${section.groups[0].id}${showAdded ? "&showAdded=true" : ""}`;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">{section.title}</h2>
        <Link
          href={editHref}
          className="inline-flex items-center gap-1 text-sm text-accent-deep hover:text-accent"
        >
          <PencilLine className="h-3.5 w-3.5" /> Edit
        </Link>
      </div>
      <Card className="divide-y divide-line">
        {section.groups.map((group) => {
          const visible = group.questions.filter((q) =>
            isQuestionVisible(q, answers)
          );
          const answered = visible.filter((q) => hasAnswer(answers[q.id]));
          if (answered.length === 0) {
            return (
              <div key={group.id} className="px-6 py-5 text-sm text-muted">
                <span className="font-medium text-ink">
                  {group.title ?? "Property details"}
                </span>{" "}
                — no answers yet.
              </div>
            );
          }
          return (
            <div key={group.id} className="px-6 py-5">
              {group.title && (
                <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
                  {group.title}
                </h3>
              )}
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                {answered.map((q) => (
                  <div
                    key={q.id}
                    className="contents"
                  >
                    <dt className="text-sm text-muted">{q.label}</dt>
                    <dd className="text-sm text-ink">
                      <AnswerView question={q} value={answers[q.id]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </Card>
    </section>
  );
}

function AnswerView({
  question,
  value,
}: {
  question: Question;
  value: AnswerValue;
}) {
  if (question.type === "repeater") {
    const items = (value as RepeaterItem[] | undefined) ?? [];
    if (items.length === 0) return <span className="text-muted">—</span>;
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-control border border-line bg-canvas/40 p-3"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {(question.itemNoun ?? "Item")} {i + 1}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {(question.subQuestions ?? [])
                .filter((sq) => isQuestionVisible(sq, item))
                .filter((sq) => hasAnswer(item[sq.id]))
                .map((sq) => (
                  <div key={sq.id} className="contents">
                    <dt className="text-muted">{sq.label}</dt>
                    <dd className="text-ink">
                      <AnswerView question={sq} value={item[sq.id]} />
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "file") {
    const files = (value as StoredFile[] | undefined) ?? [];
    if (files.length === 0) return <span className="text-muted">—</span>;
    return (
      <ul className="space-y-1">
        {files.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <FileText className="h-3.5 w-3.5 text-muted" />
            <span className="truncate">{f.name}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (question.type === "yesno") {
    return <span>{value === "yes" ? "Yes" : value === "no" ? "No" : "—"}</span>;
  }

  if (question.type === "single") {
    const opt = question.options?.find((o) => o.value === value);
    return <span>{opt?.label ?? String(value ?? "—")}</span>;
  }

  if (question.type === "multi") {
    const arr = (value as string[] | undefined) ?? [];
    if (arr.length === 0) return <span className="text-muted">—</span>;
    const labels = arr.map(
      (v) => question.options?.find((o) => o.value === v)?.label ?? v
    );
    return <span>{labels.join(", ")}</span>;
  }

  if (question.type === "number") {
    if (value === "n/a")
      return <span className="text-muted">Not applicable</span>;
    return (
      <span>
        {String(value ?? "—")}
        {question.unit && value !== undefined && value !== null && value !== ""
          ? ` ${question.unit}`
          : ""}
      </span>
    );
  }

  if (typeof value === "string" && value) {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }

  return <span className="text-muted">—</span>;
}

function hasAnswer(v: AnswerValue): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
