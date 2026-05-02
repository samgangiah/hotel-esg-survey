import { PrismaClient } from "@prisma/client";

// Avoid spinning up multiple PrismaClient instances during Next.js dev hot-reload.
// In production, this resolves to a single new client per process — which is what we want.
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const db =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = db;
}
