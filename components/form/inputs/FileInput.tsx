"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredFile } from "@/lib/schema";

export function FileInput({
  value,
  onChange,
  multiple,
}: {
  value: StoredFile[] | undefined;
  onChange: (v: StoredFile[]) => void;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const files = value ?? [];

  const append = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: StoredFile[] = multiple ? [...files] : [];
    for (const f of Array.from(incoming)) {
      next.push({ name: f.name, size: f.size, type: f.type });
      if (!multiple) break;
    }
    onChange(next);
  };

  const remove = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          append(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed bg-white px-4 py-6 text-sm transition-colors focus-visible:shadow-focus",
          drag
            ? "border-accent bg-accent-soft/40"
            : "border-line hover:border-accent/40 hover:bg-accent-soft/20"
        )}
      >
        <Upload className="h-5 w-5 text-accent" />
        <span className="font-medium text-ink">
          Drop {multiple ? "files" : "a file"} here, or click to browse
        </span>
        <span className="text-xs text-muted">
          Stored in your browser only — nothing is uploaded.
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          className="hidden"
          onChange={(e) => append(e.target.files)}
        />
      </button>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-control border border-line bg-white px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 text-muted" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded p-1 text-muted hover:bg-canvas hover:text-danger"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
