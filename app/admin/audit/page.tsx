import { Card } from "@/components/ui/Card";
import { AdminNav } from "@/components/admin/AdminNav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  await requirePlatformAdmin();

  const rows = await db.auditLog.findMany({
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

  return (
    <>
      <AdminNav active="/admin/audit" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">
            Audit log
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Recent activity
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every state-changing action recorded with actor, target, IP, and
            payload. Last 200 rows, newest first.
          </p>
        </header>

        {rows.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-muted">
            No audit entries yet.
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="px-6 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <code className="rounded bg-canvas px-2 py-0.5 text-xs">
                      {r.action}
                    </code>
                    <span className="text-xs text-muted">
                      {r.actorType}
                      {r.actorId ? ` · ${r.actorId.slice(0, 8)}…` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {r.occurredAt.toISOString().replace("T", " ").slice(0, 19)}
                    {r.ip ? ` · ${r.ip}` : ""}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {r.targetType}:{" "}
                  <span className="font-mono">{r.targetId}</span>
                </p>
                {r.payloadJson && (
                  <pre className="mt-1 overflow-x-auto rounded bg-canvas px-2 py-1 text-[11px] text-muted">
                    {JSON.stringify(r.payloadJson, null, 0)}
                  </pre>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
