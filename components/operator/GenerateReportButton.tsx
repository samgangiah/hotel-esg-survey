"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Generate-report button. Calls the server action; on success the router
 * navigates to the new report page. No confirmation step — generating is
 * non-destructive (each click creates a new versioned snapshot).
 */
export function GenerateReportButton({
  instanceId,
  onGenerate,
}: {
  instanceId: string;
  onGenerate: (
    id: string
  ) => Promise<{ ok: true; reportId: string } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function go() {
    setError(null);
    startTransition(async () => {
      const result = await onGenerate(instanceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/operator/reports/${result.reportId}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        onClick={go}
        disabled={isPending}
        title="Snapshot current answers + files into a printable report."
      >
        <FileText className="h-3.5 w-3.5" />
        {isPending ? "Generating…" : "Generate report"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
