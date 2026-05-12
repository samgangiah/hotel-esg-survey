"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Inline delegate-this-question control. Renders as a small "Delegate"
 * link by default; clicking expands a compact form (email + optional name
 * + optional note). On send, calls the server action and tells the parent
 * to refresh so the delegation state appears.
 */
export function DelegatePopover({
  questionLabel,
  onDelegate,
}: {
  questionLabel: string;
  onDelegate: (args: {
    toEmail: string;
    toName?: string;
    note?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSending] = useTransition();

  function send() {
    setError(null);
    if (!email.trim()) {
      setError("Email?");
      return;
    }
    startSending(async () => {
      const r = await onDelegate({
        toEmail: email.trim(),
        toName: name.trim() || undefined,
        note: note.trim() || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setEmail("");
      setName("");
      setNote("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-accent-deep hover:underline"
      >
        <CornerDownRight className="h-3 w-3" />
        Don&apos;t know this? Delegate to someone else
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-control border border-accent/40 bg-accent-soft/30 p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-accent-deep">
          Delegate this question
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-0.5 text-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted">
        They&apos;ll get a one-question email link for: <em>{questionLabel}</em>
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="!h-9 text-sm"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name (optional)"
          className="!h-9 text-sm"
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Short note so they know why (optional)"
        className="w-full rounded-control border border-line bg-white px-3 py-2 text-sm focus-visible:shadow-focus focus-visible:border-accent"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={send} disabled={pending}>
          {pending ? "Sending…" : "Send delegation"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Status pill shown when a question has been delegated. Click "cancel" to
 * pull the delegation back so the original respondent can answer it.
 */
export function DelegationStatus({
  delegatedToEmail,
  delegatedToName,
  forwardedFromEmail,
  onCancel,
}: {
  delegatedToEmail: string;
  delegatedToName: string | null;
  forwardedFromEmail: string | null;
  onCancel: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [pending, startCancel] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setError(null);
    startCancel(async () => {
      const r = await onCancel();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-control border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-sm">
      <p className="text-amber-900">
        <strong>Awaiting answer from</strong>{" "}
        {delegatedToName ? `${delegatedToName} (${delegatedToEmail})` : delegatedToEmail}
        {forwardedFromEmail && (
          <span className="text-xs text-amber-800">
            {" "}— forwarded via {forwardedFromEmail}
          </span>
        )}
      </p>
      <div className="mt-1 flex items-center gap-3 text-xs">
        <span className="text-amber-700">
          They&apos;ve been emailed a one-question link.
        </span>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="underline-offset-2 text-amber-900 hover:underline disabled:opacity-50"
        >
          {pending ? "Cancelling…" : "Cancel delegation"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
