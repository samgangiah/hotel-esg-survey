"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formSpec } from "@/lib/form-data";

export function ProgressStrip({
  currentSectionIndex,
}: {
  currentSectionIndex: number;
}) {
  return (
    <div className="border-b border-line bg-white/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <span className="hidden text-xs uppercase tracking-wide text-muted sm:inline">
          Step
        </span>
        <ol className="flex flex-1 items-center gap-2 sm:gap-3">
          {formSpec.sections.map((s, i) => {
            const state =
              i < currentSectionIndex
                ? "done"
                : i === currentSectionIndex
                  ? "current"
                  : "todo";
            return (
              <li
                key={s.id}
                className="flex flex-1 items-center gap-2 sm:gap-3"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                    state === "done" &&
                      "border-accent bg-accent text-white",
                    state === "current" &&
                      "border-accent bg-accent-soft text-accent-deep",
                    state === "todo" && "border-line bg-white text-muted"
                  )}
                >
                  {state === "done" ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    state === "current"
                      ? "font-medium text-ink"
                      : "text-muted"
                  )}
                >
                  {s.title}
                </span>
                {i < formSpec.sections.length - 1 && (
                  <span
                    className={cn(
                      "h-px flex-1",
                      state === "done" ? "bg-accent/40" : "bg-line"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
