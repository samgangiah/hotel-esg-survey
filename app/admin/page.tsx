import { Card } from "@/components/ui/Card";

export const metadata = { title: "Site admin dashboard" };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">Site admin</p>
        <h1 className="mt-2 font-display text-3xl text-ink">Dashboard</h1>
        <p className="mt-3 text-muted">
          Invite respondents, track progress, generate the report when complete.
        </p>
      </div>

      <Card className="space-y-3 p-6">
        <h2 className="font-display text-xl text-ink">Coming in Phase 1</h2>
        <p className="text-sm text-muted">
          For Site Admins to manage their site's survey: add respondents, assign roles &
          buildings, send invitations, see the building × role progress grid, nudge
          stragglers, and submit the survey for report generation.
        </p>
      </Card>
    </div>
  );
}
