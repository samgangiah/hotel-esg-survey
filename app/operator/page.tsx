import { Card } from "@/components/ui/Card";

export const metadata = { title: "Operator console" };

export default function OperatorPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">Operator</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Console</h1>
        <p className="mt-3 text-muted">
          Sam-only. Add new clients, monitor in-flight surveys, intervene when something's
          stuck.
        </p>
      </div>

      <Card className="space-y-3 p-6">
        <h2 className="font-display text-xl text-ink">Coming next session</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm text-muted">
          <li>Magic-link login gated to <code>OPERATOR_EMAIL</code>.</li>
          <li>"Add new client" form (org + site + buildings + first Site Admin in one submit).</li>
          <li>Health dashboard across all instances.</li>
          <li>Per-instance actions: resend invite, transfer admin, mark abandoned.</li>
          <li>Email events feed and audit log filter.</li>
        </ul>
      </Card>
    </div>
  );
}
