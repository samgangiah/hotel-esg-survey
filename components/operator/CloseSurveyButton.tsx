"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Close-survey button (and reopen, when already closed). Renders a small inline
 * confirmation step before calling the server action so we don't rely on the
 * browser's confirm() dialog. After the action completes, we refresh the route
 * so the dashboard reflects the new status without a full reload.
 */
export function CloseSurveyButton({
  instanceId,
  status,
  onClose,
  onReopen,
}: {
  instanceId: string;
  status: string;
  onClose: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onReopen: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isClosed = status === "submitted" || status === "locked";

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

  if (isClosed) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="inline-flex items-center gap-1 rounded-control border border-accent/40 bg-accent-soft/40 px-2 py-1 text-xs text-accent-deep">
          <Lock className="h-3 w-3" /> Closed
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => onReopen(instanceId))}
          className="inline-flex items-center gap-1 text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
        >
          <RotateCcw className="h-3 w-3" />
          {isPending ? "Reopening…" : "Reopen"}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setConfirming(true)}
        title="Lock the survey so respondents can't edit further. Reversible."
      >
        <Lock className="h-3.5 w-3.5" />
        Close survey
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-xs text-muted">
        Closing locks all answers. Respondents won't be able to edit further.
        You can reopen any time.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => run(() => onClose(instanceId))}
          disabled={isPending}
        >
          {isPending ? "Closing…" : "Yes, close it"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
