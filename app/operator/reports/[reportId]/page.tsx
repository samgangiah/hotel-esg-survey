import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OperatorNav } from "@/components/operator/OperatorNav";
import { ReportView } from "@/components/operator/ReportView";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import type { ReportSnapshot } from "@/lib/report";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const me = await requireOperatorAdmin();
  const { reportId } = await params;

  const report = await db.report.findUnique({
    where: { id: reportId },
    include: {
      surveyInstance: { include: { site: true } },
    },
  });
  if (!report) notFound();
  if (report.surveyInstance.site.operatorId !== me.operatorId) {
    notFound();
  }

  const snapshot = report.snapshotJson as unknown as ReportSnapshot;

  return (
    <>
      {/* On-screen chrome; hidden during print so the PDF is just the report. */}
      <div className="print:hidden">
        <OperatorNav active="/operator/reports" operatorName={me.operatorName} />
        <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              href="/operator/reports"
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All reports
            </Link>
            <a href={`/operator/reports/${report.id}/print`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                <Printer className="h-3.5 w-3.5" /> Open print view
              </Button>
            </a>
          </div>
        </div>
      </div>

      <ReportView snapshot={snapshot} />

      <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 print:hidden">
        <p className="mt-6 text-xs text-muted">
          To save as PDF: open the <strong>Print view</strong> button above,
          then use your browser's <kbd>⌘P</kbd> / <kbd>Ctrl+P</kbd> and choose{" "}
          <em>Save as PDF</em>.
        </p>
      </div>
    </>
  );
}
