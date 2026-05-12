"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/Input";

/**
 * Inline rename of the operator (company) name. Click the pencil, edit, save.
 * Used both in the setup wizard banner and on the dashboard header so the
 * customer can fix typos / rebrand without leaving their portal.
 */
export function EditOperatorName({
  currentName,
  onSave,
}: {
  currentName: string;
  onSave: (name: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Name can't be empty.");
      return;
    }
    startSaving(async () => {
      const result = await onSave(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex items-baseline gap-1">
        <span className="font-medium text-ink">{currentName}</span>
        <button
          type="button"
          onClick={() => {
            setValue(currentName);
            setError(null);
            setEditing(true);
          }}
          className="rounded p-0.5 text-muted hover:text-ink"
          title="Rename"
          aria-label="Rename operator"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="!h-7 max-w-[260px] !px-2 text-sm"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded p-1 text-accent-deep hover:bg-accent-soft/40"
        title="Save"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="rounded p-1 text-muted hover:bg-canvas hover:text-ink"
        title="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
