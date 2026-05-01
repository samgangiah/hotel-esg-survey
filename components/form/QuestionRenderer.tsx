"use client";

import { useSearchParams } from "next/navigation";
import type {
  AnswerValue,
  Answers,
  Question,
  RepeaterItem,
  StoredFile,
} from "@/lib/schema";
import { isQuestionVisible } from "@/lib/conditions";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { TextInput } from "./inputs/TextInput";
import { LongText } from "./inputs/LongText";
import { NumberInput } from "./inputs/NumberInput";
import { SingleSelect } from "./inputs/SingleSelect";
import { MultiSelect } from "./inputs/MultiSelect";
import { YesNo } from "./inputs/YesNo";
import { FileInput } from "./inputs/FileInput";
import { Repeater } from "./Repeater";

interface Props {
  question: Question;
  scope: Answers;
  getValue: (id: string) => AnswerValue;
  setValue: (id: string, v: AnswerValue) => void;
  showError?: boolean;
}

export function QuestionRenderer({
  question,
  scope,
  getValue,
  setValue,
  showError,
}: Props) {
  const searchParams = useSearchParams();
  const showAdded = searchParams.get("showAdded") === "true";

  if (!isQuestionVisible(question, scope)) return null;

  const value = getValue(question.id);
  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  const errored = showError && question.required && isEmpty;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <label className="font-medium text-ink">
          {question.label}
          {question.required && (
            <span className="ml-1 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
        {showAdded && question.added && <Pill>new</Pill>}
      </div>
      {question.help && (
        <p className="text-sm text-muted">{question.help}</p>
      )}
      <div className={cn(errored && "rounded-control ring-1 ring-danger/40")}>
        {renderInput(question, value, (v) => setValue(question.id, v))}
      </div>
      {errored && (
        <p className="text-sm text-danger">This question is required.</p>
      )}
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
          value={value as number | undefined}
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
          value={value as StoredFile[] | undefined}
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
    default:
      return null;
  }
}
