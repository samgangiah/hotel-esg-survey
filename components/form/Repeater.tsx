"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useFormStore } from "@/lib/store";
import type { Question, RepeaterItem, AnswerValue } from "@/lib/schema";
import { isQuestionVisible } from "@/lib/conditions";
import { QuestionRenderer } from "./QuestionRenderer";
import { cn } from "@/lib/utils";

export function Repeater({
  question,
  items,
}: {
  question: Question;
  items: RepeaterItem[];
}) {
  const setRepeaterCount = useFormStore((s) => s.setRepeaterCount);
  const setRepeaterItem = useFormStore((s) => s.setRepeaterItem);
  const setAnswer = useFormStore((s) => s.setAnswer);
  const noun = question.itemNoun ?? "item";

  const count = items.length;
  const [openIndex, setOpenIndex] = useState<number | null>(
    count > 0 ? count - 1 : null
  );
  // After we add/duplicate/copy-from-previous, this index is the one we want
  // the page to scroll to.
  const [pendingScroll, setPendingScroll] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Default-open the most recent item if nothing is open.
  useEffect(() => {
    if (count > 0 && openIndex === null) setOpenIndex(count - 1);
  }, [count, openIndex]);

  // Scroll-to-new-card after an add/duplicate/copy-from-previous action.
  useEffect(() => {
    if (pendingScroll === null) return;
    const el = cardRefs.current.get(pendingScroll);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setPendingScroll(null);
  }, [pendingScroll]);

  const setItem = (index: number, item: RepeaterItem) =>
    setRepeaterItem(question.id, index, item);

  const updateCountAnswer = (n: number) => {
    if (question.countQuestionId) setAnswer(question.countQuestionId, n);
  };

  const add = () => {
    const newCount = count + 1;
    setRepeaterCount(question.id, newCount);
    updateCountAnswer(newCount);
    setOpenIndex(newCount - 1);
    setPendingScroll(newCount - 1);
  };

  const addFromPrevious = () => {
    const source = items[items.length - 1];
    const clone: RepeaterItem = source
      ? JSON.parse(JSON.stringify(source))
      : {};
    const newCount = count + 1;
    setRepeaterCount(question.id, newCount);
    setItem(newCount - 1, clone);
    updateCountAnswer(newCount);
    setOpenIndex(newCount - 1);
    setPendingScroll(newCount - 1);
  };

  const remove = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    setRepeaterCount(question.id, next.length);
    next.forEach((item, idx) => setItem(idx, item));
    updateCountAnswer(next.length);
    if (openIndex !== null && openIndex >= next.length) {
      setOpenIndex(next.length > 0 ? next.length - 1 : null);
    }
  };

  /**
   * Duplicate the i-th item — append a deep-cloned copy at the end.
   * "A laundry with 8 identical machines fills in the first one, clicks
   * Duplicate seven times, and tweaks only the differences."
   */
  const duplicate = (i: number) => {
    const source = items[i];
    if (!source) return;
    const clone: RepeaterItem = JSON.parse(JSON.stringify(source));
    const newCount = count + 1;
    setRepeaterCount(question.id, newCount);
    setItem(newCount - 1, clone);
    updateCountAnswer(newCount);
    setOpenIndex(newCount - 1);
    setPendingScroll(newCount - 1);
  };

  if (count === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-muted">No {noun}s added yet.</p>
        <Button variant="secondary" onClick={add}>
          <Plus className="h-4 w-4" /> Add a {noun}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <RepeaterCard
          key={i}
          index={i}
          total={count}
          item={item}
          question={question}
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          onRemove={() => remove(i)}
          onDuplicate={() => duplicate(i)}
          registerRef={(el) => {
            if (el) cardRefs.current.set(i, el);
            else cardRefs.current.delete(i);
          }}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={add}>
          <Plus className="h-4 w-4" /> Add another {noun}
        </Button>
        <Button
          variant="ghost"
          onClick={addFromPrevious}
          title={`Add a new ${noun} pre-filled from the previous one`}
        >
          <ClipboardCopy className="h-4 w-4" />
          Copy from previous {noun}
        </Button>
      </div>
    </div>
  );
}

function RepeaterCard({
  index,
  total,
  item,
  question,
  isOpen,
  onToggle,
  onRemove,
  onDuplicate,
  registerRef,
}: {
  index: number;
  total: number;
  item: RepeaterItem;
  question: Question;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const setRepeaterItem = useFormStore((s) => s.setRepeaterItem);
  const noun = question.itemNoun ?? "item";

  const summary = useMemo(() => buildSummary(item), [item]);

  const setSubValue = (subId: string, v: AnswerValue) => {
    setRepeaterItem(question.id, index, { ...item, [subId]: v });
  };

  return (
    <Card
      ref={registerRef}
      className={cn(
        "overflow-hidden transition-shadow scroll-mt-24",
        isOpen
          ? "border-accent/50 shadow-[0_0_0_3px_rgba(47,93,80,0.08)]"
          : ""
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-5 py-4",
          isOpen && "bg-accent-soft/30"
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="font-display text-lg text-ink capitalize">
            {noun} {index + 1}
            <span className="text-muted"> of {total}</span>
          </span>
          {summary && !isOpen && (
            <span className="truncate text-sm text-muted">— {summary}</span>
          )}
          <span className="ml-auto text-muted">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-accent-soft/40 hover:text-accent-deep"
            aria-label={`Duplicate ${noun} ${index + 1}`}
            title={`Duplicate this ${noun}`}
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-danger"
            aria-label={`Remove ${noun} ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "border-t border-line bg-canvas/40 px-5 py-5",
          !isOpen && "hidden"
        )}
      >
        <div className="space-y-6">
          {(question.subQuestions ?? []).map((sq) => {
            if (!isQuestionVisible(sq, item)) return null;
            return (
              <QuestionRenderer
                key={sq.id}
                question={sq}
                scope={item}
                getValue={(id) => item[id]}
                setValue={(id, v) => setSubValue(id, v)}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function buildSummary(item: RepeaterItem): string | null {
  const parts: string[] = [];
  if (typeof item.make === "string" && item.make) parts.push(item.make);
  if (typeof item.model === "string" && item.model) parts.push(item.model);
  if (typeof item.drum_volume_kg === "number")
    parts.push(`${item.drum_volume_kg} kg`);
  return parts.length ? parts.join(" ") : null;
}
