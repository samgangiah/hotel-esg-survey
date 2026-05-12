import Link from "next/link";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { OperatorNav } from "@/components/operator/OperatorNav";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

/**
 * Reports list — every Report ever generated for this operator's instances,
 * latest first. The Operator Admin generates new ones from the dashboard;
 * here they can revisit any historical snapshot.
 */
export default async function ReportsListPage() {
  const me = await requireOperatorAdmin();

  const reports = await db.report.findMany({
    where: {
      surveyInstance: {
        site: { operatorId: me.operatorId, deletedAt: null },
      },
    },
    include: {
      surveyInstance: { include: { site: true } },
    },
    orderBy: { generatedAt: "desc" },
  });

  return (
    <>
      <OperatorNav active="/operator/reports" operatorName={me.operatorName} />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">Reports</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Generated reports
          </h1>
          <p className="mt-1 text-sm text-muted">
            One report per generation. Open any to view + print to PDF.
            Generate a new report from the dashboard.
          </p>
        </header>

        {reports.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-muted">
            No reports generated yet. Head to the{" "}
            <Link
              href="/operator"
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              dashboard
            </Link>{" "}
            and click <strong>Generate report</strong> on the site you want to
            summarise.
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/operator/reports/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-accent-soft/30"
              >
                <span className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted" />
                  <span>
                    <span className="block font-medium text-ink">
                      {r.surveyInstance.site.name}
                    </span>
                    <span className="block text-xs text-muted">
                      generated {r.generatedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-muted">{r.status}</span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
