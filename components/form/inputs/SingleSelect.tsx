"use client";

import { cn } from "@/lib/utils";
import type { Option } from "@/lib/schema";

export function SingleSelect({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const compact = options.length <= 4 && options.every((o) => o.label.length < 22);
  return (
    <div
      className={cn(
        compact
          ? "flex flex-wrap gap-2"
          : "grid gap-2 sm:grid-cols-2"
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "group flex items-center gap-3 rounded-control border bg-white px-4 py-3 text-left text-sm transition-all focus-visible:shadow-focus",
              selected
                ? "border-accent bg-accent-soft/60 text-accent-deep shadow-card"
                : "border-line hover:border-accent/40 hover:bg-accent-soft/30"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-accent" : "border-line"
              )}
            >
              {selected && (
                <span className="h-2 w-2 rounded-full bg-accent" />
              )}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
