// Plain-CJS seed script that runs in the standalone runner image (no tsx needed).
// Idempotent: skips if phs-energy v1 already seeded.

const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const QUESTIONS_PATH = path.resolve(__dirname, "..", "data", "questions.json");
const questions = require(QUESTIONS_PATH);

const db = new PrismaClient();

(async () => {
  const slug = "phs-energy";
  const version = 1;

  // Upsert: on Phase 0 we treat v1 of the locked schema as a living draft so
  // cosmetic edits to the cover page / labels propagate to existing instances
  // without inventing a v2. Once we go pilot-live with real customer data,
  // any *structural* change (new question, removed question, new question
  // type) MUST bump the version number to v2 + leave existing instances on v1.
  const result = await db.surveyTemplate.upsert({
    where: { slug_version: { slug, version } },
    update: { schemaJson: questions },
    create: { slug, version, schemaJson: questions },
  });
  console.log(
    `[seed] Upserted template ${slug} v${version} (questions.json v${questions.meta.version}) — id=${result.id}`
  );

  await db.$disconnect();
})().catch((e) => {
  console.error("[seed] Failed:", e);
  process.exit(1);
});
