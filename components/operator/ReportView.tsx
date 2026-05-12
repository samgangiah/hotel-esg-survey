import { FileText, Image as ImageIcon } from "lucide-react";
import type { ReportSnapshot, RenderedQuestion } from "@/lib/report";
import { formatAnswerForReport } from "@/lib/report";
import { formatBytes } from "@/lib/file-format";
import type {
  StoredFile,
  TableValue,
  UploadedFileRef,
} from "@/lib/schema";
import { isUploadedFileRef } from "@/lib/schema";

/**
 * Server component. Renders a snapshot as a print-friendly document.
 * Use `print:` Tailwind variants if you want to hide chrome when printing.
 *
 * The container styles keep widths reasonable for both screen and paper
 * (A4 is ~794px at 96 DPI). Sections + question tables flow naturally.
 */
export function ReportView({ snapshot }: { snapshot: ReportSnapshot }) {
  const generated = new Date(snapshot.generatedAt);
  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-10 text-ink print:max-w-none print:px-0 print:py-0">
      <header className="mb-8 border-b border-line pb-6">
        <p className="text-xs uppercase tracking-wide text-muted">
          Energy &amp; ESG survey · report
        </p>
        <h1 className="mt-1 font-display text-3xl">{snapshot.site.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {snapshot.operator.name}
          {snapshot.site.address ? ` · ${snapshot.site.address}` : ""}
        </p>
        <p className="mt-3 text-xs text-muted">
          Generated {generated.toISOString().slice(0, 10)} by{" "}
          {snapshot.generatedBy.name} · template {snapshot.instance.templateSlug}
          {" v"}
          {snapshot.instance.templateVersion}
        </p>
      </header>

      <Headline snapshot={snapshot} />

      <Buildings buildings={snapshot.buildings} />

      <Contributions contributions={snapshot.contributions} />

      <section className="mb-10">
        <h2 className="mb-4 font-display text-xl">Answers</h2>
        <div className="space-y-8">
          {snapshot.sections.map((s) => (
            <section key={s.id}>
              <h3 className="mb-2 font-display text-lg text-accent-deep">
                {s.title}
              </h3>
              {s.intro && (
                <p className="mb-3 text-sm text-muted">{s.intro}</p>
              )}
              <div className="space-y-5">
                {s.groups.map((g) => (
                  <div key={g.id}>
                    {g.title && (
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                        {g.title}
                      </h4>
                    )}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                      {g.questions.map((q) => (
                        <QuestionRow key={q.id} q={q} />
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <Files files={snapshot.uploadedFiles} />

      <Footer snapshot={snapshot} />
    </article>
  );
}

// --- Top blocks -------------------------------------------------------------

function Headline({ snapshot }: { snapshot: ReportSnapshot }) {
  const h = snapshot.headline;
  return (
    <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Buildings" value={h.buildingCount} />
      <Stat
        label="Coverage"
        value={`${h.coveragePercent}%`}
        sub={`${h.questionsAnswered}/${h.questionsTotal} answered`}
      />
      <Stat label="Files submitted" value={h.uploadedFileCount} />
      <Stat label="Contributors" value={h.contributorCount} />
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-control border border-line bg-canvas/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function Buildings({ buildings }: { buildings: ReportSnapshot["buildings"] }) {
  if (buildings.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="mb-2 font-display text-xl">Buildings</h2>
      <p className="text-sm">
        {buildings.map((b) => b.name).join(" · ")}
      </p>
    </section>
  );
}

function Contributions({
  contributions,
}: {
  contributions: ReportSnapshot["contributions"];
}) {
  if (contributions.length === 0) return null;
  return (
    <section className="mb-10">
      <h2 className="mb-2 font-display text-xl">Section contributions</h2>
      <ul className="space-y-1 text-sm">
        {contributions.map((c, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              <span className="font-medium">{c.sectionTitle}</span>{" "}
              <span className="text-muted">— {c.respondentName}</span>
            </span>
            <span className="text-xs text-muted">
              {c.submittedAt.slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Files({ files }: { files: ReportSnapshot["uploadedFiles"] }) {
  if (files.length === 0) return null;
  return (
    <section className="mb-10 break-before-page">
      <h2 className="mb-2 font-display text-xl">Files submitted</h2>
      <p className="mb-3 text-sm text-muted">
        Energy bills, EPC certificates, machine photos and other supporting
        documents uploaded by respondents.
      </p>
      <ul className="space-y-1">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/60 py-1.5 text-sm"
          >
            <span className="flex items-baseline gap-2">
              {f.mimeType.startsWith("image/") ? (
                <ImageIcon className="h-3.5 w-3.5 self-center text-muted" />
              ) : (
                <FileText className="h-3.5 w-3.5 self-center text-muted" />
              )}
              <span>
                <a
                  href={`/api/uploads/${f.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.filename}
                </a>{" "}
                <span className="text-xs text-muted">
                  ({formatBytes(f.byteSize)}) — {f.questionLabel}
                </span>
              </span>
            </span>
            <span className="text-xs text-muted">
              {f.uploadedByName} · {f.createdAt.slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Footer({ snapshot }: { snapshot: ReportSnapshot }) {
  return (
    <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
      <p>
        This report is a snapshot of answers as of{" "}
        {snapshot.generatedAt.slice(0, 10)}. Opportunity-detection analysis
        and recommendations are produced separately and will follow.
      </p>
    </footer>
  );
}

// --- Question rendering -----------------------------------------------------

function QuestionRow({ q }: { q: RenderedQuestion }) {
  return (
    <div className="contents">
      <dt className="text-sm text-muted">{q.label}</dt>
      <dd className="text-sm">
        <AnswerCell q={q} />
      </dd>
    </div>
  );
}

function AnswerCell({ q }: { q: RenderedQuestion }) {
  if (q.type === "repeater") {
    const items = q.subItems ?? [];
    if (items.length === 0) return <span className="text-muted">—</span>;
    return (
      <div className="space-y-2">
        {items.map((sub, i) => (
          <div
            key={i}
            className="rounded-control border border-line bg-canvas/30 p-3"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              Item {i + 1}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {sub.map((sq) => (
                <div key={sq.id} className="contents">
                  <dt className="text-muted">{sq.label}</dt>
                  <dd>
                    <AnswerCell q={sq} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    );
  }

  if (q.type === "file") {
    const files =
      (q.value as (StoredFile | UploadedFileRef)[] | undefined) ?? [];
    if (files.length === 0) return <span className="text-muted">—</span>;
    return (
      <ul className="space-y-1">
        {files.map((f, i) => {
          const ref = isUploadedFileRef(f);
          const name = ref ? f.filename : f.name;
          return (
            <li key={ref ? f.id : `${name}-${i}`} className="text-sm">
              {ref ? (
                <a
                  href={`/api/uploads/${f.id}`}
                  className="underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {name}
                </a>
              ) : (
                name
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  if (q.type === "table") {
    const data = (q.value as TableValue | undefined) ?? {};
    const rows = Object.keys(data);
    if (rows.length === 0) return <span className="text-muted">—</span>;
    return (
      <pre className="whitespace-pre-wrap rounded border border-line bg-canvas/20 p-2 text-[11px]">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  const formatted = formatAnswerForReport(q);
  return formatted ? <span className="whitespace-pre-wrap">{formatted}</span> : <span className="text-muted">—</span>;
}
