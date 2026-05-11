/**
 * File-upload constants + helpers.
 *
 * Storage layout on disk:
 *   $UPLOADS_DIR/<operatorId>/<instanceId>/<questionId>/<cuid>.<ext>
 *
 * The UploadedFile table is the source of truth for metadata + auth checks.
 * `storageBackend === 'local'` reads/writes through these helpers.
 * `storageBackend === 'r2'` (future) reads/writes through R2 SDK.
 */

import path from "node:path";
import { promises as fs } from "node:fs";

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR ?? "/app/uploads";
}

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

export function buildStoragePath(args: {
  operatorId: string;
  instanceId: string;
  questionId: string;
  fileId: string;
  mimeType: string;
}): { absolute: string; relative: string; folder: string } {
  const ext = extForMime(args.mimeType);
  // Sanitise — these come from internal cuids, but defence in depth.
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");
  const op = safe(args.operatorId);
  const inst = safe(args.instanceId);
  const q = safe(args.questionId);
  const fid = safe(args.fileId);
  const folder = path.join(op, inst, q);
  const filename = `${fid}.${ext}`;
  const relative = path.join(folder, filename);
  return {
    absolute: path.join(uploadsRoot(), relative),
    relative,
    folder: path.join(uploadsRoot(), folder),
  };
}

export async function ensureFolder(folder: string): Promise<void> {
  await fs.mkdir(folder, { recursive: true });
}

export async function writeFile(absolute: string, data: Buffer): Promise<void> {
  await fs.writeFile(absolute, data, { mode: 0o640 });
}

export async function readFile(absolute: string): Promise<Buffer> {
  return fs.readFile(absolute);
}

export async function fileExists(absolute: string): Promise<boolean> {
  try {
    await fs.access(absolute);
    return true;
  } catch {
    return false;
  }
}

// Pure formatting helpers (e.g. formatBytes) live in `lib/file-format.ts`
// because they're imported by client components that can't pull in `node:fs`.
export { formatBytes } from "./file-format";
