"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Undo2 } from "lucide-react";

/**
 * Per-respondent admin row controls: GDPR export + soft-delete (or restore).
 * Renders as a compact icon strip inside the operator detail page. Delete
 * uses an inline confirmation step (no browser dialog).
 */
export function RespondentControls({
  respondentId,
  isDeleted,
  onDelete,
  onUndelete,
}: {
  respondentId: string;
  isDeleted: boolean;
  onDelete: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onUndelete: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <a
          href={`/admin/respondents/${respondentId}/export.json`}
          download
          title="GDPR subject-access export (JSON)"
          className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
        {isDeleted ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => onUndelete(respondentId))}
            title="Restore"
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        ) : confirming ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="rounded px-2 py-0.5 text-[11px] text-muted hover:bg-canvas"
            >
              cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => onDelete(respondentId))}
              className="rounded px-2 py-0.5 text-[11px] text-danger hover:bg-danger/10"
            >
              {isPending ? "deleting…" : "yes, delete"}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title="Soft-delete (GDPR erasure)"
            className="rounded p-1.5 text-muted hover:bg-canvas hover:text-danger"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      {isDeleted && (
        <span className="text-[10px] uppercase tracking-wide text-danger/80">
          deleted
        </span>
      )}
    </div>
  );
}
