import { Card } from "@/components/ui/Card";

export const metadata = { title: "Recover your survey link" };

export default function RecoverPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-4 p-8 sm:p-10">
        <p className="text-xs uppercase tracking-wide text-muted">Recover</p>
        <h1 className="font-display text-3xl text-ink">Lost your link?</h1>
        <p className="text-muted">
          Enter the email address the invitation was sent to. If we have an active
          assignment for it, we'll send a fresh link.
        </p>
        <p className="text-sm text-muted">
          Self-service recovery is being wired up in Phase 0.D. For now, please reply to
          the invitation email and we'll re-issue a link.
        </p>
      </Card>
    </div>
  );
}
