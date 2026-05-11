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
      <div>
        {renderInput(question, value, (v) => setValue(question.id, v))}
      </div>
    </div>
  );
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
