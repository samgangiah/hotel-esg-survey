"use client";

import { useRef, useState } from "react";
import { Eye, FileText, Image as ImageIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isUploadedFileRef,
  type StoredFile,
  type UploadedFileRef,
} from "@/lib/schema";
import { useFormBackend, useRepeaterScope } from "../state-context";
import { formatBytes } from "@/lib/file-format";

/**
 * FileInput has two flavours, picked from `useFormBackend().mode`:
 *
 *   - mode === "demo": legacy `StoredFile` (name/size/type). No upload — used by
 *     the public marketing demo at /. Files are recorded as metadata only.
 *   - mode === "db":   real `UploadedFileRef` (id/filename/byteSize/mimeType).
 *     POSTs to /api/uploads on the active SurveyInstance; DELETE'd via
 *     /api/uploads/:id when the respondent hits remove. Progress + per-file
 *     errors surfaced inline.
 *
 * Files are mixed-shape during transition (both StoredFile and UploadedFileRef
 * may appear in `value`), and the discriminator handles either.
 */
type FileValue = StoredFile | UploadedFileRef;

interface Props {
  questionId: string;
  value: FileValue[] | undefined;
  onChange: (v: FileValue[]) => void;
  multiple?: boolean;
}

interface PendingUpload {
  localId: string;
  name: string;
  size: number;
  error?: string;
}

export function FileInput({ questionId, value, onChange, multiple }: Props) {
  const backend = useFormBackend();
  const repeaterScope = useRepeaterScope();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const files = value ?? [];
  const isDb = backend.mode === "db";

  async function uploadOne(file: File): Promise<UploadedFileRef | { error: string }> {
    if (!backend.instanceId) return { error: "Missing survey context" };
    const fd = new FormData();
    fd.append("instanceId", backend.instanceId);
    fd.append("questionId", questionId);
    if (repeaterScope) {
      fd.append("repeaterParentId", repeaterScope.parentQuestionId);
      fd.append("repeaterIndex", String(repeaterScope.index));
    }
    fd.append("file", file);

    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        file?: UploadedFileRef;
      };
      if (!res.ok || !json.ok || !json.file) {
        return { error: json.error ?? `Upload failed (HTTP ${res.status}).` };
      }
      return json.file;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  }

  async function handleFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);

    if (!isDb) {
      // Demo: just record metadata.
      const next: FileValue[] = multiple ? [...files] : [];
      for (const f of list) {
        next.push({ name: f.name, size: f.size, type: f.type });
        if (!multiple) break;
      }
      onChange(next);
      return;
    }

    // DB mode — POST each file, append on success.
    const limited = multiple ? list : list.slice(0, 1);
    const initialPending: PendingUpload[] = limited.map((f) => ({
      localId: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: f.size,
    }));
    setPending((p) => [...p, ...initialPending]);

    const results = await Promise.all(
      limited.map(async (f, idx) => {
        const result = await uploadOne(f);
        return { localId: initialPending[idx].localId, result };
      })
    );

    const successes: UploadedFileRef[] = [];
    setPending((p) => {
      const errored: PendingUpload[] = [];
      for (const r of results) {
        if ("error" in r.result) {
          const found = p.find((x) => x.localId === r.localId);
          if (found) errored.push({ ...found, error: r.result.error });
        } else {
          successes.push(r.result);
        }
      }
      // Drop completed (both success and error) from pending, keep the
      // error rows for a few seconds so the user can read them.
      const successIds = new Set(
        results.filter((r) => !("error" in r.result)).map((r) => r.localId)
      );
      const errorIds = new Set(errored.map((e) => e.localId));
      const next = p.filter((x) => !successIds.has(x.localId) && !errorIds.has(x.localId));
      return [...next, ...errored];
    });

    if (successes.length > 0) {
      const next: FileValue[] = multiple ? [...files, ...successes] : successes.slice(0, 1);
      onChange(next);
    }
  }

  async function removeAt(i: number) {
    const target = files[i];
    if (isDb && target && isUploadedFileRef(target)) {
      try {
        await fetch(`/api/uploads/${target.id}`, { method: "DELETE" });
      } catch {
        /* best-effort; row will be orphaned but the answer no longer references it. */
      }
    }
    onChange(files.filter((_, idx) => idx !== i));
  }

  function dismissError(localId: string) {
    setPending((p) => p.filter((x) => x.localId !== localId));
  }

  const hintLine = isDb
    ? "Max 10 MB · JPEG, PNG, GIF, WebP, HEIC, HEIF, or PDF"
    : "Stored in your browser only — nothing is uploaded.";

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
          void handleFiles(e.dataTransfer.files);
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
        <span className="text-xs text-muted">{hintLine}</span>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={
            isDb
              ? "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf"
              : undefined
          }
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            // Reset so picking the same file twice still fires onChange.
            if (e.target) e.target.value = "";
          }}
        />
      </button>

      {(files.length > 0 || pending.length > 0) && (
        <ul className="space-y-1">
          {files.map((f, i) => {
            const ref = isUploadedFileRef(f);
            const name = ref ? f.filename : f.name;
            const size = ref ? f.byteSize : f.size;
            const mime = ref ? f.mimeType : f.type;
            const isImage = mime.startsWith("image/");
            return (
              <li
                key={ref ? f.id : `${name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-control border border-line bg-white px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 truncate">
                  {isImage ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-muted" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                  )}
                  <span className="truncate" title={name}>
                    {name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {formatBytes(size)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {ref && (
                    <a
                      href={`/api/uploads/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded p-1 text-muted hover:bg-canvas hover:text-accent-deep"
                      aria-label={`View ${name}`}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void removeAt(i)}
                    className="rounded p-1 text-muted hover:bg-canvas hover:text-danger"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              </li>
            );
          })}
          {pending.map((p) => (
            <li
              key={p.localId}
              className={cn(
                "flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-sm",
                p.error
                  ? "border-danger/40 bg-danger/5"
                  : "border-line bg-canvas/40"
              )}
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                {p.error ? (
                  <X className="h-4 w-4 shrink-0 text-danger" />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                )}
                <span className="truncate" title={p.name}>
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {formatBytes(p.size)}
                </span>
              </span>
              {p.error ? (
                <span className="flex items-center gap-2 text-xs text-danger">
                  <span className="truncate" title={p.error}>
                    {p.error}
                  </span>
                  <button
                    type="button"
                    onClick={() => dismissError(p.localId)}
                    className="rounded p-1 hover:bg-white"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <span className="text-xs text-muted">Uploading…</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
