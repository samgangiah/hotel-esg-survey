"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Option } from "@/lib/schema";

export function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string[] | undefined;
  onChange: (v: string[]) => void;
}) {
  const set = new Set(value ?? []);
  const toggle = (v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const selected = set.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={cn(
              "flex items-center gap-3 rounded-control border bg-white px-4 py-3 text-left text-sm transition-all focus-visible:shadow-focus",
              selected
                ? "border-accent bg-accent-soft/60 text-accent-deep shadow-card"
                : "border-line hover:border-accent/40 hover:bg-accent-soft/30"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                selected ? "border-accent bg-accent" : "border-line"
              )}
            >
              {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
