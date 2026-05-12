/**
 * Report snapshot logic — pure projection from a SurveyInstance (+ its
 * answers + uploaded files + locked template) into a typed `ReportSnapshot`
 * that we persist in `Report.snapshotJson`.
 *
 * The snapshot is immutable: once generated, it captures what the team
 * submitted at that moment. Subsequent edits to answers don't change a
 * generated report.
 *
 * Phase 0 keeps `headline` deliberately small — counts + coverage — because
 * the opportunity-detection logic is Penny's domain and will land later.
 * The renderer in `components/operator/ReportView.tsx` reads from `headline`
 * and `sections` only — so as we add derived figures (kWh per room, etc.),
 * we plug them into `headline` and pick them up automatically.
 */

import type {
  Answers,
  AnswerValue,
  FormSpec,
  Question,
  RepeaterItem,
  Section,
} from "@/lib/schema";
import { isQuestionVisible } from "@/lib/conditions";

export interface ReportSnapshot {
  /** ISO timestamp at generation. */
  generatedAt: string;
  /** Who clicked the button. */
  generatedBy: { name: string; email: string };
  /** Identity. */
  operator: { id: string; name: string };
  site: { id: string; name: string; address: string | null };
  buildings: Array<{ id: string; name: string }>;
  instance: {
    id: string;
    status: string;
    templateSlug: string;
    templateVersion: number;
    createdAt: string;
    lockedAt: string | null;
  };
  /** Aggregate figures that don't depend on Penny's analysis. */
  headline: {
    buildingCount: number;
    questionsAnswered: number;
    questionsTotal: number;
    coveragePercent: number;
    uploadedFileCount: number;
    contributorCount: number;
  };
  /** Section-by-section flat dump for the body of the report. */
  sections: Array<{
    id: string;
    title: string;
    intro: string | null;
    groups: Array<{
      id: string;
      title: string | null;
      questions: Array<RenderedQuestion>;
    }>;
  }>;
  /** Flat file index used for the "Files submitted" appendix. */
  uploadedFiles: Array<{
    id: string;
    filename: string;
    byteSize: number;
    mimeType: string;
    questionId: string;
    questionLabel: string;
    uploadedByName: string;
    createdAt: string;
  }>;
  /** Section-submission roster — who marked which section done + when. */
  contributions: Array<{
    sectionId: string;
    sectionTitle: string;
    respondentName: string;
    submittedAt: string;
  }>;
}

/**
 * One question as it appears in the report. `value` is the raw answer; the
 * renderer formats it. `subItems` is populated for repeater questions —
 * each entry is one repeater item rendered as its own mini-question list.
 */
export interface RenderedQuestion {
  id: string;
  label: string;
  type: Question["type"];
  unit?: string;
  options?: Array<{ value: string; label: string }>;
  value: AnswerValue;
  subItems?: Array<Array<RenderedQuestion>>;
  /** True iff this question is the kind of thing we always show, even unanswered. */
  alwaysShow?: boolean;
}

// Types for the rows we pull from Prisma. We accept anything that matches
// the shape — that lets the action be flexible about its `include` and keeps
// this file decoupled from `@prisma/client` imports.
interface SnapshotInput {
  generatedBy: { name: string; email: string };
  operator: { id: string; name: string };
  site: { id: string; name: string; address: string | null };
  buildings: Array<{ id: string; name: string }>;
  instance: {
    id: string;
    status: string;
    createdAt: Date;
    lockedAt: Date | null;
    template: { slug: string; version: number; schemaJson: unknown };
  };
  /** All answers across the instance (we don't filter by respondent). */
  answers: Array<{
    questionId: string;
    valueJson: unknown;
    respondentId: string;
  }>;
  sectionSubmissions: Array<{
    sectionId: string;
    submittedAt: Date;
    respondent: { name: string };
  }>;
  uploadedFiles: Array<{
    id: string;
    filename: string;
    byteSize: number;
    mimeType: string;
    questionId: string;
    createdAt: Date;
    respondent: { name: string };
  }>;
}

export function buildSnapshot(input: SnapshotInput): ReportSnapshot {
  const spec = input.instance.template.schemaJson as FormSpec;

  // Project answers into a flat { questionId -> value } map. The instance has
  // many answers across buildings/respondents but the schema (Phase 0) uses
  // one row per question — so de-dup by questionId, last write wins.
  const answers: Answers = {};
  for (const a of input.answers) {
    answers[a.questionId] = a.valueJson as AnswerValue;
  }

  // Build the section/group/question render tree. We preserve everything in
  // the locked template (no scope filtering) — the report is the full picture.
  let answeredCount = 0;
  let totalCount = 0;

  const sections = spec.sections.map((section) => ({
    id: section.id,
    title: section.title,
    intro: section.intro ?? null,
    groups: section.groups.map((group) => ({
      id: group.id,
      title: group.title ?? null,
      questions: group.questions
        .filter((q) => isQuestionVisible(q, answers))
        .map((q) => renderQuestion(q, answers[q.id], answers, { count: true })),
    })),
  }));

  // Re-walk to count answered + total (renderQuestion already shaped the tree).
  for (const s of sections) {
    for (const g of s.groups) {
      for (const q of g.questions) {
        const { answered, total } = countAnswered(q);
        answeredCount += answered;
        totalCount += total;
      }
    }
  }

  // Build the file index — give each file its question's label for context.
  const labelByQuestion = indexQuestionLabels(spec);
  const uploadedFiles = input.uploadedFiles.map((f) => ({
    id: f.id,
    filename: f.filename,
    byteSize: f.byteSize,
    mimeType: f.mimeType,
    questionId: f.questionId,
    questionLabel: labelByQuestion.get(f.questionId) ?? f.questionId,
    uploadedByName: f.respondent.name,
    createdAt: f.createdAt.toISOString(),
  }));

  const sectionTitleById = new Map(spec.sections.map((s) => [s.id, s.title]));
  const contributions = input.sectionSubmissions.map((s) => ({
    sectionId: s.sectionId,
    sectionTitle: sectionTitleById.get(s.sectionId) ?? s.sectionId,
    respondentName: s.respondent.name,
    submittedAt: s.submittedAt.toISOString(),
  }));

  const contributorIds = new Set(input.answers.map((a) => a.respondentId));

  return {
    generatedAt: new Date().toISOString(),
    generatedBy: input.generatedBy,
    operator: input.operator,
    site: input.site,
    buildings: input.buildings,
    instance: {
      id: input.instance.id,
      status: input.instance.status,
      templateSlug: input.instance.template.slug,
      templateVersion: input.instance.template.version,
      createdAt: input.instance.createdAt.toISOString(),
      lockedAt: input.instance.lockedAt?.toISOString() ?? null,
    },
    headline: {
      buildingCount: input.buildings.length,
      questionsAnswered: answeredCount,
      questionsTotal: totalCount,
      coveragePercent:
        totalCount === 0 ? 0 : Math.round((answeredCount / totalCount) * 100),
      uploadedFileCount: input.uploadedFiles.length,
      contributorCount: contributorIds.size,
    },
    sections,
    uploadedFiles,
    contributions,
  };
}

// --- helpers ----------------------------------------------------------------

function renderQuestion(
  q: Question,
  value: AnswerValue,
  scope: Answers,
  _opts: { count: boolean }
): RenderedQuestion {
  // Repeater — render each item as its own question list, applying conditions
  // against the item's own scope.
  if (q.type === "repeater") {
    const items = (value as RepeaterItem[] | undefined) ?? [];
    const subItems = items.map((item) =>
      (q.subQuestions ?? [])
        .filter((sq) => isQuestionVisible(sq, item))
        .map((sq) => renderQuestion(sq, item[sq.id], item, { count: true }))
    );
    return {
      id: q.id,
      label: q.label,
      type: q.type,
      value,
      subItems,
    };
  }
  // For everything else, just shape the value alongside its metadata.
  return {
    id: q.id,
    label: q.label,
    type: q.type,
    unit: q.unit,
    options: q.options,
    value,
  };
}

function isAnswered(v: AnswerValue): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function countAnswered(q: RenderedQuestion): { answered: number; total: number } {
  if (q.type === "repeater") {
    let a = 0;
    let t = 0;
    // The repeater itself counts once — it's answered if there's at least one item.
    t += 1;
    if (q.subItems && q.subItems.length > 0) a += 1;
    // Then each sub-question in each item counts.
    for (const item of q.subItems ?? []) {
      for (const sub of item) {
        const inner = countAnswered(sub);
        a += inner.answered;
        t += inner.total;
      }
    }
    return { answered: a, total: t };
  }
  return { answered: isAnswered(q.value) ? 1 : 0, total: 1 };
}

function indexQuestionLabels(spec: FormSpec): Map<string, string> {
  const out = new Map<string, string>();
  for (const section of spec.sections) {
    for (const group of section.groups) {
      walk(out, group.questions, "");
    }
  }
  return out;
}

function walk(
  out: Map<string, string>,
  questions: Question[],
  prefix: string
) {
  for (const q of questions) {
    out.set(q.id, `${prefix}${q.label}`);
    if (q.subQuestions) walk(out, q.subQuestions, `${prefix}${q.label} → `);
  }
}

/** Tiny helper for the renderer — turn a raw `value` into a human string. */
export function formatAnswerForReport(q: RenderedQuestion): string {
  const v = q.value;
  if (!isAnswered(v)) return "—";
  if (q.type === "yesno") return v === "yes" ? "Yes" : v === "no" ? "No" : "—";
  if (q.type === "single") {
    const opt = q.options?.find((o) => o.value === v);
    return opt?.label ?? String(v ?? "—");
  }
  if (q.type === "multi" && Array.isArray(v)) {
    return (v as string[])
      .map((x) => q.options?.find((o) => o.value === x)?.label ?? x)
      .join(", ");
  }
  if (q.type === "number") {
    if (v === "n/a") return "Not applicable";
    return q.unit ? `${v} ${q.unit}` : String(v);
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  // table / file / repeater — caller renders explicitly
  return "";
}

// Re-export to make Section + Group types convenient for the renderer.
export type { Section };
