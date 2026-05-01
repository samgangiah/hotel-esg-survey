"use client";

import { cn } from "@/lib/utils";

export function NumberInput({
  value,
  onChange,
  unit,
}: {
  value: number | "" | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-full max-w-xs items-center rounded-control border border-line bg-white pr-3 transition-shadow focus-within:shadow-focus focus-within:border-accent"
      )}
    >
      <input
        type="number"
        inputMode="decimal"
        className="h-full w-full rounded-control bg-transparent px-3 outline-none placeholder:text-muted/70"
        value={value ?? ""}
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
  );
}
