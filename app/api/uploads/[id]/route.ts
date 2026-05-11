import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getRespondent } from "@/lib/respondent-auth";
import { getPlatformAdminSessionId } from "@/lib/auth/session";
import { fileExists, readFile, uploadsRoot } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Who is allowed to read or modify this UploadedFile.
 *
 * - The respondent who uploaded it (most common).
 * - Any respondent assigned to the same SurveyInstance (operator-admins included
 *   — they have an `all` assignment).
 * - A Platform Admin via the platform-admin cookie.
 *
 * Returns the file row + a short reason for the audit log, or null.
 */
async function authoriseFileAccess(fileId: string): Promise<
  | {
      file: NonNullable<Awaited<ReturnType<typeof db.uploadedFile.findUnique>>>;
      via: "owner" | "co_respondent" | "platform_admin";
      actorType: "respondent" | "platform_admin";
      actorId: string;
    }
  | { error: string; status: number }
> {
  const file = await db.uploadedFile.findUnique({ where: { id: fileId } });
  if (!file || file.deletedAt) {
    return { error: "File not found.", status: 404 };
  }

  // Platform admin path
  const adminSessionId = await getPlatformAdminSessionId();
  if (adminSessionId) {
    const adminSession = await db.platformAdminSession.findUnique({
      where: { id: adminSessionId },
    });
    if (adminSession && adminSession.expiresAt >= new Date()) {
      return {
        file,
        via: "platform_admin",
        actorType: "platform_admin",
        actorId: adminSession.platformAdminId,
      };
    }
  }

  // Respondent path
  const me = await getRespondent();
  if (!me) return { error: "Not signed in.", status: 401 };

  if (file.respondentId === me.respondentId) {
    return { file, via: "owner", actorType: "respondent", actorId: me.respondentId };
  }

  // Anyone with an assignment on the same instance can read.
  const assignment = await db.assignment.findFirst({
    where: {
      surveyInstanceId: file.surveyInstanceId,
      respondentId: me.respondentId,
    },
    select: { id: true },
  });
  if (assignment) {
    return {
      file,
      via: "co_respondent",
      actorType: "respondent",
      actorId: me.respondentId,
    };
  }

  return { error: "Not authorised for this file.", status: 403 };
}

/**
 * GET /api/uploads/:id — stream the file inline (images + PDFs render in tab).
 * Add `?download=1` to force a download instead of inline rendering.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await authoriseFileAccess(id);
  if ("error" in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { file } = auth;

  // Defence in depth: resolve to absolute path and verify it lives under uploads root.
  const root = path.resolve(uploadsRoot());
  const absolute = path.resolve(root, file.storagePath);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    return NextResponse.json(
      { ok: false, error: "Refusing path-traversal." },
      { status: 400 }
    );
  }

  if (!(await fileExists(absolute))) {
    return NextResponse.json(
      { ok: false, error: "File missing from storage." },
      { status: 410 }
    );
  }

  const bytes = await readFile(absolute);
  const forceDownload = req.nextUrl.searchParams.get("download") === "1";
  const disposition = `${forceDownload ? "attachment" : "inline"}; filename="${file.filename.replace(/"/g, "")}"`;

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=300",
    },
  });
}

/**
 * DELETE /api/uploads/:id — soft-delete. Owners can delete while the survey is
 * still open; platform admins can delete any time. The blob is left on disk
 * and a future cron will purge soft-deleted files.
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await authoriseFileAccess(id);
  if ("error" in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const { file, via, actorType, actorId } = auth;

  // Only the owner or a platform admin can delete. Co-respondents can read
  // (so they can see what their teammate uploaded) but not delete.
  if (via === "co_respondent") {
    return NextResponse.json(
      { ok: false, error: "Only the uploader can delete this file." },
      { status: 403 }
    );
  }

  // If the respondent is the owner, the instance must still be open.
  if (via === "owner") {
    const instance = await db.surveyInstance.findUnique({
      where: { id: file.surveyInstanceId },
      select: { status: true },
    });
    if (instance && (instance.status === "submitted" || instance.status === "locked")) {
      return NextResponse.json(
        { ok: false, error: "Survey is closed — cannot delete file." },
        { status: 409 }
      );
    }
  }

  await db.uploadedFile.update({
    where: { id: file.id },
    data: { deletedAt: new Date() },
  });

  await audit({
    actorType,
    actorId,
    action: "file.deleted",
    targetType: "UploadedFile",
    targetId: file.id,
    payload: {
      surveyInstanceId: file.surveyInstanceId,
      questionId: file.questionId,
      filename: file.filename,
      via,
    },
  });

  return NextResponse.json({ ok: true });
}
