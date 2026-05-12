import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AdminNav } from "@/components/admin/AdminNav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { formatBytes } from "@/lib/file-format";

export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";

/**
 * Per-operator file inventory. Every uploaded file across every site /
 * survey instance / respondent, with inline thumbnails for images and
 * direct links to view + download. Soft-deleted files are excluded.
 *
 * The page intentionally renders thumbnails via /api/uploads/:id — that
 * route enforces platform-admin access, so listing here doesn't bypass
 * authorisation.
 */
export default async function OperatorFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  const operator = await db.operator.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!operator) notFound();

  const files = await db.uploadedFile.findMany({
    where: {
      deletedAt: null,
      surveyInstance: {
        site: { operatorId: operator.id },
      },
    },
    include: {
      respondent: true,
      surveyInstance: { include: { site: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalBytes = files.reduce((a, f) => a + f.byteSize, 0);

  return (
    <>
      <AdminNav active="/admin" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-4">
          <Link
            href={`/admin/operators/${operator.id}`}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to operator
          </Link>
        </div>

        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">Files</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            {operator.name} — uploads
          </h1>
          <p className="mt-1 text-sm text-muted">
            {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} total.
            Click a row to view; the icon on the right is a direct download.
          </p>
        </header>

        {files.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-muted">
            No files have been uploaded for this operator yet.
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {files.map((f) => {
              const isImage = f.mimeType.startsWith("image/");
              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
                >
                  <a
                    href={`/api/uploads/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 group"
                  >
                    {isImage ? (
                      <img
                        src={`/api/uploads/${f.id}`}
                        alt={f.filename}
                        className="h-10 w-10 shrink-0 rounded border border-line object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-line bg-canvas/40">
                        <FileText className="h-4 w-4 text-muted" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink group-hover:text-accent-deep">
                        {f.filename}
                      </span>
                      <span className="block text-xs text-muted truncate">
                        {f.surveyInstance.site.name} · question{" "}
                        <code className="font-mono text-[11px]">
                          {f.questionId}
                        </code>{" "}
                        · {f.respondent.name}
                      </span>
                    </span>
                  </a>
                  <span className="flex items-center gap-3 text-xs text-muted">
                    <span className="hidden sm:inline">
                      {formatBytes(f.byteSize)} · {f.mimeType}
                    </span>
                    <span>
                      {f.createdAt.toISOString().slice(0, 10)}
                    </span>
                    <a
                      href={`/api/uploads/${f.id}?download=1`}
                      title="Download"
                      className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </>
  );
}

