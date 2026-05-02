import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    ok: true,
    db: "unknown" as "ok" | "fail" | "unknown",
    time: new Date().toISOString(),
    version: process.env.APP_VERSION ?? "dev",
  };

  try {
    await db.$queryRaw`SELECT 1`;
    result.db = "ok";
  } catch {
    result.db = "fail";
    result.ok = false;
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
