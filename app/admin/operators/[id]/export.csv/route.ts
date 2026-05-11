import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { formSpec } from "@/lib/form-data";
import type { FormSpec, Question } from "@/lib/schema";

export const dynamic = "force-dynamic";

/**
 * Platform Admin download: answers in long-format CSV — one row per
 * (site, building, section, group, question, respondent). Easy to open in
 * Excel / Sheets, pivot, filter, group by site or by section.
 *
 * Each instance is exported against its LOCKED template version (template
 * row's schemaJson), so the section/group/question labels match what the
 * respondent actually saw, even if questions.json on disk has moved on.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await requirePlatformAdmin();
  const { id } = await params;

  const operator = await db.operator.findFirst({
    where: { id, deletedAt: null },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          buildings: { where: { deletedAt: null } },
          surveyInstances: {
            include: {
              template: true,
              answers: {
                include: { respondent: true, building: true },
                orderBy: { answeredAt: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!operator) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = [
    "operator",
    "site",
    "building",
    "section_id",
    "section_title",
    "group_id",
    "group_title",
    "question_id",
    "question_label",
    "question_type",
    "respondent_name",
    "respondent_email",
    "respondent_role_or_admin",
    "value",
    "answered_at",
    "updated_at",
  ];
  const rows: string[][] = [headers];

  for (const site of operator.sites) {
    for (const instance of site.surveyInstances) {
      const spec =
        (instance.template?.schemaJson as unknown as FormSpec | undefined) ??
        formSpec;
      const qIndex = indexQuestions(spec);

      for (const ans of instance.answers) {
        const meta = qIndex.get(ans.questionId);
        const respondentRole =
          ans.respondent.isOperatorAdmin
            ? "operator_admin"
            : "respondent";
        rows.push([
          operator.name,
          site.name,
          ans.building.name,
          meta?.sectionId ?? "",
          meta?.sectionTitle ?? "",
          meta?.groupId ?? "",
          meta?.groupTitle ?? "",
          ans.questionId,
          meta?.questionLabel ?? "",
          meta?.questionType ?? "",
          ans.respondent.name,
          ans.respondent.email,
          respondentRole,
          stringifyValue(ans.valueJson),
          ans.answeredAt.toISOString(),
          ans.updatedAt.toISOString(),
        ]);
      }
    }
  }

  await audit({
    actorType: "platform_admin",
    actorId: me.platformAdminId,
    action: "operator.export.csv",
    targetType: "Operator",
    targetId: operator.id,
    payload: { answerRowCount: rows.length - 1 },
  });

  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  const safeName = operator.name.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const ts = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}-answers-${ts}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

// --- helpers ---------------------------------------------------------------

interface QuestionMeta {
  sectionId: string;
  sectionTitle: string;
  groupId: string;
  groupTitle: string;
  questionLabel: string;
  questionType: string;
}

function indexQuestions(spec: FormSpec): Map<string, QuestionMeta> {
  const out = new Map<string, QuestionMeta>();
  for (const section of spec.sections) {
    for (const group of section.groups) {
      for (const q of group.questions) {
        addQuestion(out, section, group, q, "");
        if (q.subQuestions) {
          for (const sq of q.subQuestions) {
            addQuestion(out, section, group, sq, `${q.label} → `);
          }
        }
      }
    }
  }
  return out;
}

function addQuestion(
  map: Map<string, QuestionMeta>,
  section: { id: string; title: string },
  group: { id: string; title: string | null },
  q: Question,
  labelPrefix: string
) {
  map.set(q.id, {
    sectionId: section.id,
    sectionTitle: section.title,
    groupId: group.id,
    groupTitle: group.title ?? "",
    questionLabel: `${labelPrefix}${q.label}`,
    questionType: q.type,
  });
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  // UploadedFileRef[] → render as `filename (id, NN KB); ...` for readability.
  if (Array.isArray(v) && v.length > 0 && isUploadedFileRefRow(v[0])) {
    return (v as Array<{ id: string; filename: string; byteSize: number }>)
      .map((f) => `${f.filename} (${f.id}, ${Math.ceil(f.byteSize / 1024)} KB)`)
      .join("; ");
  }

  // arrays, objects (table values, repeater items, etc.) → JSON
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function isUploadedFileRefRow(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { filename?: unknown }).filename === "string" &&
    typeof (x as { byteSize?: unknown }).byteSize === "number"
  );
}

function escapeCsv(cell: string): string {
  if (cell === undefined || cell === null) return "";
  const needsQuoting = /[",\n\r]/.test(cell);
  if (!needsQuoting) return cell;
  return `"${cell.replace(/"/g, '""')}"`;
}
