"use client";

import { useSearchParams } from "next/navigation";
import type {
  AnswerValue,
  Answers,
  Question,
  RepeaterItem,
  StoredFile,
  TableValue,
  UploadedFileRef,
} from "@/lib/schema";
import { isQuestionVisible } from "@/lib/conditions";
import { Pill } from "@/components/ui/Pill";
import { TextInput } from "./inputs/TextInput";
import { LongText } from "./inputs/LongText";
import { NumberInput } from "./inputs/NumberInput";
import { SingleSelect } from "./inputs/SingleSelect";
import { MultiSelect } from "./inputs/MultiSelect";
import { YesNo } from "./inputs/YesNo";
import { FileInput } from "./inputs/FileInput";
import { TableInput } from "./inputs/TableInput";
import { Repeater } from "./Repeater";
import { useFormBackend, useRepeaterScope } from "./state-context";
import {
  DelegatePopover,
  DelegationStatus,
} from "./delegate/DelegatePopover";
import {
  delegateQuestion,
  cancelDelegation,
} from "./backends/delegate-actions";

interface Props {
  question: Question;
  scope: Answers;
  getValue: (id: string) => AnswerValue;
  setValue: (id: string, v: AnswerValue) => void;
  index?: number; // 1-based, for question numbering within a group
}

const MULTI_HINT = "Select all that apply.";

export function QuestionRenderer({
  question,
  scope,
  getValue,
  setValue,
  index,
}: Props) {
  const searchParams = useSearchParams();
  const showAdded = searchParams.get("showAdded") === "true";
  const backend = useFormBackend();
  const repeaterScope = useRepeaterScope();

  if (!isQuestionVisible(question, scope)) return null;

  const value = getValue(question.id);

  // Auto-add "Select all that apply" on multi-select questions if not already in help.
  const help =
    question.type === "multi"
      ? question.help && question.help.toLowerCase().includes("select all")
        ? question.help
        : question.help
          ? `${question.help} (${MULTI_HINT})`
          : MULTI_HINT
      : question.help;

  // Delegation is supported on top-level questions only (not repeater
  // sub-questions, where the row context can't be reproduced over email
  // — and not file / table / repeater question types themselves, which
  // don't fit on a one-question micro-page).
  const delegationsByQ = backend.delegations;
  const activeDelegation = delegationsByQ[question.id];
  const canDelegate =
    backend.canDelegate &&
    !!backend.instanceId &&
    !repeaterScope &&
    !["repeater", "file", "table"].includes(question.type);
  const isDelegated = !!activeDelegation;

  // "Answered by X" byline — the survey is shared across the team, so it's
  // useful to see who last filled a question in. Top-level questions only.
  const answeredBy =
    !repeaterScope && hasAnswer(value)
      ? backend.answeredBy[question.id]
      : undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <label className="font-medium text-ink">
          {typeof index === "number" && (
            <span className="mr-2 text-muted">{index}.</span>
          )}
          {question.label}
        </label>
        {showAdded && question.added && <Pill>new</Pill>}
      </div>
      {help && <p className="text-sm text-muted">{help}</p>}
      {isDelegated ? (
        <DelegationStatus
          delegatedToEmail={activeDelegation.delegatedToEmail}
          delegatedToName={activeDelegation.delegatedToName}
          forwardedFromEmail={activeDelegation.forwardedFromEmail}
          onCancel={async () => cancelDelegation(activeDelegation.id)}
        />
      ) : (
        <>
          <div>
            {renderInput(question, value, (v) => setValue(question.id, v))}
          </div>
          {answeredBy && (
            <p className="text-xs text-muted">
              Answered by{" "}
              <span className="font-medium text-ink">{answeredBy.name}</span>
            </p>
          )}
          {canDelegate && backend.instanceId && (
            <DelegatePopover
              questionLabel={question.label}
              onDelegate={(args) =>
                delegateQuestion({
                  instanceId: backend.instanceId!,
                  questionId: question.id,
                  ...args,
                })
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/** Local copy of the "is this answer non-empty" check used elsewhere. */
function hasAnswer(v: AnswerValue): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function renderInput(
  q: Question,
  value: AnswerValue,
  set: (v: AnswerValue) => void
) {
  switch (q.type) {
    case "text":
      return (
        <TextInput
          value={(value as string) ?? ""}
          onChange={(v) => set(v)}
        />
      );
    case "longtext":
      return (
        <LongText value={(value as string) ?? ""} onChange={(v) => set(v)} />
      );
    case "number":
      return (
        <NumberInput
          value={value as number | "n/a" | undefined}
          unit={q.unit}
          onChange={(v) => set(v)}
        />
      );
    case "single":
      return (
        <SingleSelect
          options={q.options ?? []}
          value={value as string | undefined}
          onChange={(v) => set(v)}
        />
      );
    case "multi":
      return (
        <MultiSelect
          options={q.options ?? []}
          value={value as string[] | undefined}
          onChange={(v) => set(v)}
        />
      );
    case "yesno":
      return (
        <YesNo value={value as string | undefined} onChange={(v) => set(v)} />
      );
    case "date":
      return (
        <TextInput
          type="date"
          value={(value as string) ?? ""}
          onChange={(v) => set(v)}
        />
      );
    case "time":
      return (
        <TextInput
          type="time"
          value={(value as string) ?? ""}
          onChange={(v) => set(v)}
        />
      );
    case "file":
      return (
        <FileInput
          questionId={q.id}
          value={value as (StoredFile | UploadedFileRef)[] | undefined}
          multiple={q.multiple}
          onChange={(v) => set(v)}
        />
      );
    case "repeater":
      return (
        <Repeater
          question={q}
          items={(value as RepeaterItem[] | undefined) ?? []}
        />
      );
    case "table":
      return (
        <TableInput
          rows={q.rows ?? []}
          columns={q.columns ?? []}
          value={value as TableValue | undefined}
          onChange={(v) => set(v)}
        />
      );
    default:
      return null;
  }
}
