import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getRespondent } from "@/lib/respondent-auth";
import {
  ALLOWED_MIME_TYPES,
  MAX_BYTES,
  buildStoragePath,
  ensureFolder,
  writeFile,
} from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/uploads
 *
 * Multipart form fields:
 *   - instanceId        SurveyInstance id (required)
 *   - questionId        question id (or sub-question id if inside a repeater)
 *   - repeaterParentId  parent repeater question id (optional)
 *   - repeaterIndex     0-based index inside the repeater (optional)
 *   - file              the uploaded blob
 *
 * Auth: respondent must be signed in AND have an Assignment on instanceId.
 * Writes to disk under $UPLOADS_DIR and creates an UploadedFile row.
 */
export async function POST(req: NextRequest) {
  const me = await getRespondent();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed multipart body." },
      { status: 400 }
    );
  }

  const instanceId = (form.get("instanceId") ?? "").toString().trim();
  const questionId = (form.get("questionId") ?? "").toString().trim();
  const repeaterParentRaw = form.get("repeaterParentId");
  const repeaterIndexRaw = form.get("repeaterIndex");
  const fileEntry = form.get("file");

  if (!instanceId || !questionId) {
    return NextResponse.json(
      { ok: false, error: "instanceId and questionId are required." },
      { status: 400 }
    );
  }
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file in request." },
      { status: 400 }
    );
  }
  if (fileEntry.size === 0) {
    return NextResponse.json(
      { ok: false, error: "File is empty." },
      { status: 400 }
    );
  }
  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File exceeds 10 MB limit.` },
      { status: 413 }
    );
  }
  if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unsupported file type: ${fileEntry.type || "unknown"}. Allowed: JPEG, PNG, GIF, WebP, HEIC, HEIF, PDF.`,
      },
      { status: 415 }
    );
  }

  const repeaterParentId =
    typeof repeaterParentRaw === "string" && repeaterParentRaw.length
      ? repeaterParentRaw
      : null;
  const repeaterIndex =
    typeof repeaterIndexRaw === "string" && repeaterIndexRaw.length
      ? Number.parseInt(repeaterIndexRaw, 10)
      : null;
  if (repeaterIndex !== null && (!Number.isFinite(repeaterIndex) || repeaterIndex < 0)) {
    return NextResponse.json(
      { ok: false, error: "repeaterIndex must be a non-negative integer." },
      { status: 400 }
    );
  }

  // ---- authorisation ----------------------------------------------------
  const instance = await db.surveyInstance.findFirst({
    where: {
      id: instanceId,
      assignments: { some: { respondentId: me.respondentId } },
    },
    include: {
      site: {
        include: {
          buildings: { where: { deletedAt: null } },
          operator: true,
        },
      },
      assignments: { where: { respondentId: me.respondentId } },
    },
  });
  if (!instance) {
    return NextResponse.json(
      { ok: false, error: "Not authorised for this survey." },
      { status: 403 }
    );
  }
  if (instance.status === "submitted" || instance.status === "locked") {
    return NextResponse.json(
      { ok: false, error: "Survey is closed — uploads not accepted." },
      { status: 409 }
    );
  }

  const scopedBuildingId =
    instance.assignments.find((a) => a.buildingId !== null)?.buildingId ?? null;
  const anchorBuildingId =
    scopedBuildingId ??
    instance.site.primaryBuildingId ??
    instance.site.buildings[0]?.id ??
    null;
  if (!anchorBuildingId) {
    return NextResponse.json(
      { ok: false, error: "Site has no buildings — cannot anchor upload." },
      { status: 500 }
    );
  }

  // ---- write to disk ----------------------------------------------------
  const fileId = `c${randomBytes(12).toString("base64url")}`;
  const paths = buildStoragePath({
    operatorId: instance.site.operatorId,
    instanceId: instance.id,
    questionId,
    fileId,
    mimeType: fileEntry.type,
  });

  try {
    await ensureFolder(paths.folder);
    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    await writeFile(paths.absolute, bytes);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to write file: ${e instanceof Error ? e.message : "unknown"}`,
      },
      { status: 500 }
    );
  }

  // ---- record in DB -----------------------------------------------------
  const row = await db.uploadedFile.create({
    data: {
      id: fileId,
      surveyInstanceId: instance.id,
      questionId,
      buildingId: anchorBuildingId,
      respondentId: me.respondentId,
      repeaterParentId,
      repeaterIndex,
      filename: fileEntry.name || `upload.${fileEntry.type.split("/")[1] ?? "bin"}`,
      byteSize: fileEntry.size,
      mimeType: fileEntry.type,
      storageBackend: "local",
      storagePath: paths.relative,
    },
  });

  await audit({
    actorType: "respondent",
    actorId: me.respondentId,
    action: "file.uploaded",
    targetType: "UploadedFile",
    targetId: row.id,
    payload: {
      surveyInstanceId: instance.id,
      questionId,
      filename: row.filename,
      byteSize: row.byteSize,
      mimeType: row.mimeType,
    },
  });

  return NextResponse.json({
    ok: true,
    file: {
      id: row.id,
      filename: row.filename,
      byteSize: row.byteSize,
      mimeType: row.mimeType,
    },
  });
}
