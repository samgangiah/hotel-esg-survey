/**
 * One-off: add a single Operator Admin to SHNL (and optionally a
 * PlatformAdmin row) and email them a magic link.
 *
 * Hardcoded for Hayley Dingley.
 *
 * Run from inside phs-app container:
 *   docker exec phs-app node scripts/add-shnl-admin.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { randomBytes, createHash } = require("crypto");

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM || "PHS Energy <noreply@phsenergy.co.uk>";

const db = new PrismaClient();
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const PERSON = {
  name: "Hayley Dingley",
  email: "hayleydingley@googlemail.com",
  alsoPlatformAdmin: true,
  role: "gm", // assignment role for OA
};

const INVITER = "Sam";
const OPERATOR_NAME = "SHNL";

function newToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

function welcomeText({ toName, magicLink, operatorName, inviterName }) {
  return [
    `Hi ${toName.split(" ")[0]},`,
    "",
    `${inviterName} has set up an Operator Admin account for you on the PHS Energy platform for ${operatorName}.`,
    "",
    "PHS Energy collects energy & ESG data across your hotel portfolio. As Operator Admin you see the survey for every hotel under SHNL, can review answers across the team, and submit the final return.",
    "",
    "Confirm your identity and open your portal here:",
    magicLink,
    "",
    "This link works for 14 days. The first device you open it on becomes bound to your session.",
    "",
    "— Sam",
  ].join("\n");
}

function welcomeHtml({ toName, magicLink, operatorName, inviterName }) {
  const first = toName.split(" ")[0];
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1F2421;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:24px;margin:0 0 16px;">Welcome to PHS Energy</h1>
  <p>Hi ${first},</p>
  <p>${inviterName} has set up an <strong>Operator Admin</strong> account for you on the PHS Energy platform for <strong>${operatorName}</strong>.</p>
  <p>PHS Energy collects energy &amp; ESG data across your hotel portfolio. As Operator Admin you see the survey for every hotel under SHNL, can review answers across the team, and submit the final return.</p>
  <p style="margin:24px 0;">
    <a href="${magicLink}" style="background:#2F5D50;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Confirm and open my portal</a>
  </p>
  <p style="color:#6B7470;font-size:13px;">Or copy &amp; paste this URL: <a href="${magicLink}">${magicLink}</a></p>
  <p style="color:#6B7470;font-size:13px;">This link works for 14 days. The first device you open it on becomes bound to your session.</p>
  <p style="color:#6B7470;font-size:13px;">— Sam</p>
</div>`.trim();
}

async function sendEmail(payload) {
  if (!RESEND_API_KEY) {
    console.log(`  [no Resend key — would have sent to ${payload.to}]`);
    return;
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error(
      `  FAILED -> ${payload.to}: HTTP ${resp.status} ${JSON.stringify(body)}`
    );
    return;
  }
  console.log(`  sent -> ${payload.to}  resend-id=${body.id || "(no id)"}`);
}

async function main() {
  const emailLower = PERSON.email.toLowerCase();

  // Find SHNL operator + its in-flight survey instances
  const operator = await db.operator.findFirst({
    where: { name: OPERATOR_NAME, deletedAt: null },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          surveyInstances: {
            where: { status: { in: ["draft", "in_progress"] } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!operator) {
    throw new Error(`Operator "${OPERATOR_NAME}" not found.`);
  }
  const instances = operator.sites.flatMap((s) =>
    s.surveyInstances.length ? [s.surveyInstances[0]] : []
  );
  if (!instances.length) {
    throw new Error(`No active SurveyInstances under ${OPERATOR_NAME}.`);
  }
  console.log(`Operator: ${operator.name} (${operator.id})`);
  console.log(`  Will assign to ${instances.length} instance(s).`);

  // Refuse to dup
  const existing = await db.respondent.findUnique({
    where: { operatorId_email: { operatorId: operator.id, email: emailLower } },
  });
  if (existing) {
    throw new Error(`Respondent already exists for ${emailLower}.`);
  }

  // Optional PlatformAdmin (idempotent)
  if (PERSON.alsoPlatformAdmin) {
    await db.platformAdmin.upsert({
      where: { email: emailLower },
      update: { name: PERSON.name },
      create: { name: PERSON.name, email: emailLower },
    });
    console.log(`PlatformAdmin upserted: ${PERSON.name} <${emailLower}>`);
  }

  // Respondent + Assignments + Invitation in one tx
  const { magicLink } = await db.$transaction(async (tx) => {
    const respondent = await tx.respondent.create({
      data: {
        operatorId: operator.id,
        email: emailLower,
        name: PERSON.name,
        isOperatorAdmin: true,
      },
    });
    const assignments = [];
    for (const instance of instances) {
      const a = await tx.assignment.create({
        data: {
          surveyInstanceId: instance.id,
          respondentId: respondent.id,
          role: PERSON.role,
          sectionId: "all",
          buildingId: null,
        },
      });
      assignments.push(a);
    }
    const { token, hash } = newToken();
    await tx.invitation.create({
      data: {
        assignmentId: assignments[0].id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
      },
    });
    return { magicLink: `${APP_URL}/r/${token}` };
  });
  console.log(`Respondent + assignments + invitation written.`);
  console.log(`Magic link: ${magicLink}`);

  console.log(`\nSending welcome email...`);
  await sendEmail({
    to: PERSON.email,
    subject: `Welcome to PHS Energy — set up ${OPERATOR_NAME}`,
    text: welcomeText({
      toName: PERSON.name,
      magicLink,
      operatorName: OPERATOR_NAME,
      inviterName: INVITER,
    }),
    html: welcomeHtml({
      toName: PERSON.name,
      magicLink,
      operatorName: OPERATOR_NAME,
      inviterName: INVITER,
    }),
  });
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
