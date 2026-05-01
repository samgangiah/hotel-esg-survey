"use client";

import { cn } from "@/lib/utils";

export function YesNo({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const opts = [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ];
  return (
    <div className="inline-flex rounded-control border border-line bg-white p-1">
      {opts.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-w-[88px] rounded-[6px] px-4 py-1.5 text-sm font-medium transition-all focus-visible:shadow-focus",
              selected
                ? "bg-accent text-white"
                : "text-ink hover:bg-accent-soft/60"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
