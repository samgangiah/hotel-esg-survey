"use client";

import { useState, useTransition } from "react";
import { CornerDownRight, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextInput } from "../inputs/TextInput";
import { LongText } from "../inputs/LongText";
import { NumberInput } from "../inputs/NumberInput";
import { SingleSelect } from "../inputs/SingleSelect";
import { MultiSelect } from "../inputs/MultiSelect";
import { YesNo } from "../inputs/YesNo";
import type { AnswerValue, Question } from "@/lib/schema";

/**
 * One-question micro-page rendered at /d/[token]. The recipient can answer
 * directly, or pass the question on to someone else who'll get the same
 * one-question link.
 *
 * Repeater + file + table questions aren't supported via delegation v1 —
 * those need richer context than fits on a single page. We block here and
 * tell the user to ask the delegator to handle it instead.
 */
export function DelegatedQuestion({
  token,
  question,
  sectionTitle,
  groupTitle,
  delegatorName,
  delegatorEmail,
  siteName,
  operatorName,
  toEmail,
  toName,
  note,
  onSubmit,
  onForward,
}: {
  token: string;
  question: Question;
  sectionTitle: string;
  groupTitle: string | null;
  delegatorName: string;
  delegatorEmail: string;
  siteName: string;
  operatorName: string;
  toEmail: string;
  toName: string | null;
  note: string | null;
  onSubmit: (args: {
    token: string;
    value: AnswerValue;
    delegateName?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onForward: (args: {
    token: string;
    toEmail: string;
    toName?: string;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [value, setValue] = useState<AnswerValue>(undefined);
  const [delegateName, setDelegateName] = useState(toName ?? "");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const [forwarding, setForwarding] = useState(false);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardName, setForwardName] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [forwardDone, setForwardDone] = useState(false);
  const [sendingForward, startForward] = useTransition();

  const unsupported = ["repeater", "file", "table"].includes(question.type);

  function doSubmit() {
    setSubmitError(null);
    startSubmit(async () => {
      const r = await onSubmit({
        token,
        value,
        delegateName: delegateName.trim() || undefined,
      });
      if (!r.ok) {
        setSubmitError(r.error);
        return;
      }
      setSubmitted(true);
    });
  }

  function doForward() {
    setForwardError(null);
    startForward(async () => {
      const r = await onForward({
        token,
        toEmail: forwardTo.trim(),
        toName: forwardName.trim() || undefined,
        note: forwardNote.trim() || undefined,
      });
      if (!r.ok) {
        setForwardError(r.error);
        return;
      }
      setForwardDone(true);
    });
  }

  if (submitted) {
    return (
      <ThanksCard
        heading="Thanks!"
        body={`Your answer has been recorded against the energy survey for ${siteName}. ${delegatorName} will be notified.`}
      />
    );
  }
  if (forwardDone) {
    return (
      <ThanksCard
        heading="Passed on"
        body={`${forwardTo} has been emailed and will see this question instead. No further action is needed from you.`}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted">
          {operatorName} · {siteName}
        </p>
        <h1 className="mt-1 font-display text-2xl text-ink">
          One question for you
        </h1>
        <p className="mt-2 text-sm text-muted">
          {delegatorName} ({delegatorEmail}) has asked you to answer one
          question on the energy survey for {siteName}. It should take less
          than a minute.
        </p>
        {note && (
          <p className="mt-3 rounded-control border border-line bg-canvas/40 px-3 py-2 text-sm text-ink">
            <span className="text-xs uppercase tracking-wide text-muted">
              Note from {delegatorName}:
            </span>
            <br />
            {note}
          </p>
        )}
      </header>

      <Card className="px-5 py-5 sm:px-6">
        <p className="text-xs uppercase tracking-wide text-muted">
          {sectionTitle}
          {groupTitle ? ` · ${groupTitle}` : ""}
        </p>
        <h2 className="mt-1 font-display text-lg text-ink">{question.label}</h2>
        {question.help && (
          <p className="mt-1 text-sm text-muted">{question.help}</p>
        )}

        <div className="mt-4">
          {unsupported ? (
            <UnsupportedNotice type={question.type} />
          ) : (
            renderInput(question, value, setValue)
          )}
        </div>

        {!unsupported && (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <div className="space-y-1.5">
              <label
                htmlFor="delegateName"
                className="text-xs font-medium text-ink"
              >
                Your name{" "}
                <span className="text-muted font-normal">
                  (so your answer is properly attributed)
                </span>
              </label>
              <Input
                id="delegateName"
                value={delegateName}
                onChange={(e) => setDelegateName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            {submitError && (
              <p className="text-sm text-danger">{submitError}</p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setForwarding((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                <CornerDownRight className="h-3 w-3" />
                I don&apos;t know — pass it on
              </button>
              <Button onClick={doSubmit} disabled={submitting}>
                <Send className="h-3.5 w-3.5" />
                {submitting ? "Submitting…" : "Submit answer"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {(forwarding || unsupported) && (
        <Card className="mt-4 px-5 py-5 sm:px-6">
          <h3 className="font-display text-base text-ink">
            Pass this question to someone else
          </h3>
          <p className="mt-1 text-sm text-muted">
            They&apos;ll get a fresh one-question link and the chain to{" "}
            {delegatorName} stays intact.
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="forwardTo"
                className="text-xs font-medium text-ink"
              >
                Their email
              </label>
              <Input
                id="forwardTo"
                type="email"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                placeholder="someone@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="forwardName"
                className="text-xs font-medium text-ink"
              >
                Their name{" "}
                <span className="text-muted font-normal">(optional)</span>
              </label>
              <Input
                id="forwardName"
                value={forwardName}
                onChange={(e) => setForwardName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="forwardNote"
                className="text-xs font-medium text-ink"
              >
                Note{" "}
                <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                id="forwardNote"
                rows={2}
                value={forwardNote}
                onChange={(e) => setForwardNote(e.target.value)}
                placeholder="A short note so they know why they're getting this"
                className="w-full rounded-control border border-line bg-white px-3 py-2 text-sm focus-visible:shadow-focus focus-visible:border-accent"
              />
            </div>
            {forwardError && (
              <p className="text-sm text-danger">{forwardError}</p>
            )}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={doForward}
                disabled={sendingForward}
              >
                <CornerDownRight className="h-3.5 w-3.5" />
                {sendingForward ? "Sending…" : "Send to them"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        Sent to {toName ? `${toName} · ` : ""}
        {toEmail}
      </p>
    </div>
  );
}

function ThanksCard({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-3 p-8 text-center sm:p-10">
        <h1 className="font-display text-2xl text-ink">{heading}</h1>
        <p className="text-muted">{body}</p>
      </Card>
    </div>
  );
}

function UnsupportedNotice({ type }: { type: Question["type"] }) {
  return (
    <p className="rounded-control border border-amber-300/50 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
      This question is a <strong>{type}</strong>, which can&apos;t be answered
      via delegation yet. Pass it on to someone with the full survey access
      instead.
    </p>
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
        <TextInput value={(value as string) ?? ""} onChange={(v) => set(v)} />
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
    default:
      return null;
  }
}
