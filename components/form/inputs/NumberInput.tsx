"use client";

import { cn } from "@/lib/utils";

type NumberValue = number | "n/a" | undefined;

export function NumberInput({
  value,
  onChange,
  unit,
}: {
  value: NumberValue;
  onChange: (v: NumberValue) => void;
  unit?: string;
}) {
  const isNA = value === "n/a";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          "flex h-11 w-full max-w-xs items-center rounded-control border border-line bg-white pr-3 transition-shadow focus-within:shadow-focus focus-within:border-accent",
          isNA && "opacity-50"
        )}
      >
        <input
          type="number"
          inputMode="decimal"
          disabled={isNA}
          className="h-full w-full rounded-control bg-transparent px-3 outline-none placeholder:text-muted/70 disabled:cursor-not-allowed"
          value={isNA ? "" : (value ?? "")}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") onChange(undefined);
            else {
              const n = Number(raw);
              onChange(Number.isNaN(n) ? undefined : n);
            }
          }}
        />
        {unit && (
          <span className="ml-1 select-none text-sm text-muted">{unit}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(isNA ? undefined : "n/a")}
        aria-pressed={isNA}
        className={cn(
          "h-9 rounded-control border px-3 text-xs font-medium transition-colors focus-visible:shadow-focus",
          isNA
            ? "border-accent bg-accent-soft text-accent-deep"
            : "border-line bg-white text-muted hover:border-accent/40 hover:text-ink"
        )}
      >
        {isNA ? "✓ Not applicable" : "Not applicable"}
      </button>
    </div>
  );
}
