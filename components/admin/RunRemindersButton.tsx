"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PassResult {
  ok: true;
  considered: number;
  sent: number;
  breakdown: Record<string, number>;
}

export function RunRemindersButton({
  onRun,
}: {
  onRun: () => Promise<PassResult | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [last, setLast] = useState<PassResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function go() {
    setError(null);
    startTransition(async () => {
      const r = await onRun();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setLast(r);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={go} disabled={isPending} size="sm">
        <Bell className="h-3.5 w-3.5" />
        {isPending ? "Running…" : "Run pass now"}
      </Button>
      {last && (
        <p className="text-xs text-muted">
          considered {last.considered} · sent {last.sent}
          {Object.keys(last.breakdown).length > 0 && (
            <>
              {" · "}
              {Object.entries(last.breakdown)
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")}
            </>
          )}
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
