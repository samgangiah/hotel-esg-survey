"use client";

import { Textarea } from "@/components/ui/Textarea";

export function LongText({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Textarea
      rows={3}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
