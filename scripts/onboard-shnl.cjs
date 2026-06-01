/**
 * One-off onboarding script for SHNL (DoubleTree Harrogate + Newcastle).
 *
 * Creates:
 *   - PlatformAdmin: Penny
 *   - Operator: SHNL
 *   - 2 Sites + 1 primary Building + 1 SurveyInstance each
 *   - 4 Operator Admins (Rob Cook, Oushan, Penny, Sam) assigned to BOTH hotels
 *   - 4 hotel staff (Andrew/Anna/Kyle for Harrogate, Rob Dixon for Newcastle)
 *     scoped to their own hotel only
 *   - 1 Invitation (magic-link token) per respondent
 *   - Sends a welcome/invitation email per respondent via Resend
 *
 * Idempotency: refuses to run if SHNL already exists. Manually archive the
 * old SHNL operator first if you need to re-run.
 *
 * Run from inside the phs-app container:
 *   docker exec phs-app node scripts/onboard-shnl.cjs
 */
const { PrismaClient } = require("@prisma/client");
const { randomBytes, createHash } = require("crypto");

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM || "PHS Energy <noreply@phsenergy.co.uk>";

const db = new PrismaClient();
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function newToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

const HOTELS = [
  {
    siteName: "DoubleTree by Hilton Harrogate Majestic Hotel and Spa",
    buildingName: "Main building",
    staff: [
      {
        name: "Andrew Glover",
        email: "Andrew.Glover@doubletree-harrogate.co.uk",
        role: "gm",
        roleLabel: "General Manager",
      },
      {
        name: "Anna Borejko",
        email: "housekeepingmgr@doubletree-harrogate.co.uk",
        role: "housekeeping",
        roleLabel: "Head of Housekeeping",
      },
      {
        name: "Kyle Wilkinson",
        email: "kyle.wilkinson@doubletree-harrogate.co.uk",
        role: "engineering",
        roleLabel: "Head of Maintenance",
      },
    ],
  },
  {
    siteName: "DoubleTree by Hilton Newcastle International Airport",
    buildingName: "Main building",
    staff: [
      {
        name: "Rob Dixon",
        email: "Rob.Dixon@doubletree-newcastle.co.uk",
        role: "gm",
        roleLabel: "General Manager",
      },
    ],
  },
];

// Operator Admins — span BOTH hotels.
const OPERATOR_ADMINS = [
  { name: "Rob Cook", email: "Robert.cook@shnl.co.uk", role: "finance" },
  {
    name: "Oushan Deeljore",
    email: "Oushan.Deeljore@shnl.co.uk",
    role: "gm",
  },
  { name: "Penelope Court", email: "pcourt1@gmail.com", role: "gm" },
  { name: "Sam Gangiah", email: "samendran@gmail.com", role: "gm" },
];

// Platform Admins — log in via /admin/login with their own magic flow.
// No automatic email; they sign in when they need to.
const PLATFORM_ADMINS = [{ name: "Penelope Court", email: "pcourt1@gmail.com" }];

const INVITER = "Sam";

function welcomeText(args) {
  return [
    `Hi ${args.toName.split(" ")[0]},`,
    "",
    `${args.inviterName} has set up an Operator Admin account for you on the PHS Energy platform for ${args.operatorName}.`,
    "",
    "PHS Energy collects energy & ESG data across your hotel portfolio. As Operator Admin you see the survey for every hotel under SHNL, can review answers across the team, and submit the final return.",
    "",
    "Confirm your identity and open your portal here:",
    args.magicLink,
    "",
    "This link works for 14 days. The first device you open it on becomes bound to your session.",
    "",
    "— Sam",
  ].join("\n");
}

function welcomeHtml(args) {
  const first = args.toName.split(" ")[0];
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1F2421;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:24px;margin:0 0 16px;">Welcome to PHS Energy</h1>
  <p>Hi ${first},</p>
  <p>${args.inviterName} has set up an <strong>Operator Admin</strong> account for you on the PHS Energy platform for <strong>${args.operatorName}</strong>.</p>
  <p>PHS Energy collects energy &amp; ESG data across your hotel portfolio. As Operator Admin you see the survey for every hotel under SHNL, can review answers across the team, and submit the final return.</p>
  <p style="margin:24px 0;">
    <a href="${args.magicLink}" style="background:#2F5D50;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Confirm and open my portal</a>
  </p>
  <p style="color:#6B7470;font-size:13px;">Or copy &amp; paste this URL: <a href="${args.magicLink}">${args.magicLink}</a></p>
  <p style="color:#6B7470;font-size:13px;">This link works for 14 days. The first device you open it on becomes bound to your session.</p>
  <p style="color:#6B7470;font-size:13px;">— Sam</p>
</div>`.trim();
}

function invitationText(args) {
  return [
    `Hi ${args.toName.split(" ")[0]},`,
    "",
    `${args.inviterName} has invited you to take part in the PHS Energy survey for ${args.siteName} as ${args.roleLabel}.`,
    "",
    "The survey gathers energy & ESG data your hotel needs for sustainability reporting. You can see questions your colleagues have already answered, fill in your section, and delegate questions to anyone on the team who knows the answer.",
    "",
    "Confirm your identity and start here:",
    args.magicLink,
    "",
    "This link works for 14 days. The first device you open it on becomes bound to your session.",
    "",
    "— Sam",
  ].join("\n");
}

function invitationHtml(args) {
  const first = args.toName.split(" ")[0];
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1F2421;max-width:560px;margin:0 auto;padding:24px;">
  <h1 style="font-size:24px;margin:0 0 16px;">You're invited to the PHS Energy survey</h1>
  <p>Hi ${first},</p>
  <p>${args.inviterName} has invited you to take part in the PHS Energy survey for <strong>${args.siteName}</strong> as <strong>${args.roleLabel}</strong>.</p>
  <p>The survey gathers energy &amp; ESG data your hotel needs for sustainability reporting. You can see questions your colleagues have already answered, fill in your section, and delegate questions to anyone on the team who knows the answer.</p>
  <p style="margin:24px 0;">
    <a href="${args.magicLink}" style="background:#2F5D50;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Confirm and start the survey</a>
  </p>
  <p style="color:#6B7470;font-size:13px;">Or copy &amp; paste this URL: <a href="${args.magicLink}">${args.magicLink}</a></p>
  <p style="color:#6B7470;font-size:13px;">This link works for 14 days. The first device you open it on becomes bound to your session.</p>
  <p style="color:#6B7470;font-size:13px;">— Sam</p>
</div>`.trim();
}

async function sendEmail(payload) {
  if (!RESEND_API_KEY) {
    console.log(`  [no Resend key set — would have sent to ${payload.to}]`);
    return;
  }
  try {
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
  } catch (err) {
    console.error(`  FAILED -> ${payload.to}: ${err?.message || err}`);
  }
}

async function main() {
  // Sanity guards
  if (!APP_URL.startsWith("https://")) {
    console.warn(`WARN: APP_URL is "${APP_URL}" — magic links will use this.`);
  }
  if (!RESEND_API_KEY) {
    console.warn("WARN: RESEND_API_KEY not set — magic links will print but emails will NOT send.");
  }

  // Refuse to double-create
  const existing = await db.operator.findFirst({
    where: { name: "SHNL", deletedAt: null },
  });
  if (existing) {
    console.error(`SHNL operator already exists (id=${existing.id}). Aborting.`);
    process.exit(1);
  }

  const template = await db.surveyTemplate.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!template) {
    throw new Error("No SurveyTemplate found. Run scripts/seed.cjs first.");
  }
  console.log(`Using template ${template.id} (slug=${template.slug} v${template.version})`);

  // PlatformAdmin(s) — outside the tx; idempotent upsert.
  for (const pa of PLATFORM_ADMINS) {
    await db.platformAdmin.upsert({
      where: { email: pa.email.toLowerCase() },
      update: { name: pa.name },
      create: { name: pa.name, email: pa.email.toLowerCase() },
    });
    console.log(`PlatformAdmin upserted: ${pa.name} <${pa.email}>`);
  }

  // Everything else in one transaction
  const { emailJobs } = await db.$transaction(async (tx) => {
    const operator = await tx.operator.create({ data: { name: "SHNL" } });
    console.log(`Operator created: SHNL (${operator.id})`);

    const siteCtx = [];
    for (const hotel of HOTELS) {
      const site = await tx.site.create({
        data: { operatorId: operator.id, name: hotel.siteName },
      });
      const building = await tx.building.create({
        data: { siteId: site.id, name: hotel.buildingName },
      });
      await tx.site.update({
        where: { id: site.id },
        data: { primaryBuildingId: building.id },
      });
      const instance = await tx.surveyInstance.create({
        data: {
          siteId: site.id,
          templateId: template.id,
          status: "in_progress",
        },
      });
      siteCtx.push({
        site,
        building,
        instance,
        siteName: hotel.siteName,
        staff: hotel.staff,
      });
      console.log(`  Site: ${hotel.siteName} (instance=${instance.id})`);
    }

    const jobs = [];

    // OAs — one Respondent each, assigned to BOTH instances, ONE invitation
    for (const oa of OPERATOR_ADMINS) {
      const respondent = await tx.respondent.create({
        data: {
          operatorId: operator.id,
          email: oa.email.toLowerCase(),
          name: oa.name,
          isOperatorAdmin: true,
        },
      });
      const assignments = [];
      for (const ctx of siteCtx) {
        const a = await tx.assignment.create({
          data: {
            surveyInstanceId: ctx.instance.id,
            respondentId: respondent.id,
            role: oa.role,
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
      const magicLink = `${APP_URL}/r/${token}`;
      const args = {
        toName: oa.name,
        magicLink,
        operatorName: "SHNL",
        inviterName: INVITER,
      };
      jobs.push({
        to: oa.email,
        subject: `Welcome to PHS Energy — set up ${args.operatorName}`,
        text: welcomeText(args),
        html: welcomeHtml(args),
      });
      console.log(`  OA: ${oa.name} <${oa.email}>  ->  ${magicLink}`);
    }

    // Hotel staff — Respondent + Assignment to their hotel only, Invitation
    for (const ctx of siteCtx) {
      for (const s of ctx.staff) {
        const respondent = await tx.respondent.create({
          data: {
            operatorId: operator.id,
            email: s.email.toLowerCase(),
            name: s.name,
            isOperatorAdmin: false,
          },
        });
        const a = await tx.assignment.create({
          data: {
            surveyInstanceId: ctx.instance.id,
            respondentId: respondent.id,
            role: s.role,
            sectionId: "all",
            buildingId: ctx.building.id,
          },
        });
        const { token, hash } = newToken();
        await tx.invitation.create({
          data: {
            assignmentId: a.id,
            tokenHash: hash,
            expiresAt: new Date(Date.now() + FOURTEEN_DAYS_MS),
          },
        });
        const magicLink = `${APP_URL}/r/${token}`;
        const args = {
          toName: s.name,
          magicLink,
          siteName: ctx.siteName,
          inviterName: INVITER,
          roleLabel: s.roleLabel,
        };
        jobs.push({
          to: s.email,
          subject: `You're invited to the PHS Energy survey for ${ctx.siteName}`,
          text: invitationText(args),
          html: invitationHtml(args),
        });
        console.log(`  Staff: ${s.name} <${s.email}> (${ctx.siteName})  ->  ${magicLink}`);
      }
    }

    return { emailJobs: jobs };
  });

  console.log(`\nSending ${emailJobs.length} email(s)...`);
  for (const job of emailJobs) {
    await sendEmail(job);
  }
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
