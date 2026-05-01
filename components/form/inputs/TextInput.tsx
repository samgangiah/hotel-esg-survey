"use client";

import { Input } from "@/components/ui/Input";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "date" | "time";
}) {
  return (
    <Input
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(e.target.value.trim())}
    />
  );
}
