import { PrismaClient } from "@prisma/client";
import questions from "../data/questions.json";

const db = new PrismaClient();

async function main() {
  // Hotel Energy v1 — current questions.json (template version 0.3 inside the JSON;
  // template DB version is its own counter starting at 1).
  const slug = "hotel-energy";
  const version = 1;

  const existing = await db.surveyTemplate.findUnique({
    where: { slug_version: { slug, version } },
  });
  if (existing) {
    console.log(`Template ${slug} v${version} already seeded — skipping.`);
    return;
  }

  await db.surveyTemplate.create({
    data: {
      slug,
      version,
      schemaJson: questions as object,
    },
  });
  console.log(`Seeded template ${slug} v${version} (questions.json v${(questions as { meta: { version: string } }).meta.version}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
