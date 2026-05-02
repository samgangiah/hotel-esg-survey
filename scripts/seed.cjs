// Plain-CJS seed script that runs in the standalone runner image (no tsx needed).
// Idempotent: skips if hotel-energy v1 already seeded.

const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const QUESTIONS_PATH = path.resolve(__dirname, "..", "data", "questions.json");
const questions = require(QUESTIONS_PATH);

const db = new PrismaClient();

(async () => {
  const slug = "hotel-energy";
  const version = 1;

  const existing = await db.surveyTemplate.findUnique({
    where: { slug_version: { slug, version } },
  });

  if (existing) {
    console.log(`[seed] Already seeded: ${slug} v${version}`);
  } else {
    await db.surveyTemplate.create({
      data: { slug, version, schemaJson: questions },
    });
    console.log(
      `[seed] Created template ${slug} v${version} (questions.json v${questions.meta.version})`
    );
  }

  await db.$disconnect();
})().catch((e) => {
  console.error("[seed] Failed:", e);
  process.exit(1);
});
