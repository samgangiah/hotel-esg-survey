import { notFound } from "next/navigation";
import { ReportView } from "@/components/operator/ReportView";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import type { ReportSnapshot } from "@/lib/report";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report — print view" };

/**
 * Bare-chrome view of a report for printing or saving as PDF. No nav, no
 * footer — just the document, so it lands cleanly on A4.
 */
export default async function ReportPrintPage({
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
  if (report.surveyInstance.site.operatorId !== me.operatorId) notFound();

  const snapshot = report.snapshotJson as unknown as ReportSnapshot;
  return <ReportView snapshot={snapshot} />;
}
