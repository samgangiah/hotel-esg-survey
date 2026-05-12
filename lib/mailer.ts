// Mailer — Resend-backed in production, falls back to a console stub when
// RESEND_API_KEY is unset (useful for local dev and for Phase 0 before keys
// are provisioned). Same call signatures in both modes.

import { Resend } from "resend";

interface OperatorLoginEmail {
  email: string;
  magicLink: string;
}

interface InvitationEmail {
  to: string;
  toName: string;
  magicLink: string;
  siteName: string;
  inviterName: string;
  roleLabel: string;
}

interface RecoveryEmail {
  to: string;
  toName: string;
  magicLink: string;
  siteName: string;
  roleLabel: string;
}

interface ReminderEmail {
  to: string;
  toName: string;
  magicLink: string;
  siteName: string;
  roleLabel: string;
  tier: 1 | 2 | 3;
}

interface WelcomeEmail {
  to: string;
  toName: string;
  magicLink: string;
  operatorName: string;
  inviterName: string;
}

interface DelegationEmail {
  to: string;
  toName: string | null;
  magicLink: string;
  delegatorName: string;
  siteName: string;
  questionLabel: string;
  note: string | null;
}

interface DelegationCompletedEmail {
  to: string;          // back to the delegator
  toName: string;
  delegateEmail: string;
  questionLabel: string;
  siteName: string;
  surveyUrl: string;
}

interface SectionSubmittedEmail {
  to: string;             // Operator Admin
  toName: string;
  submitterName: string;
  sectionTitle: string;
  siteName: string;
  progressUrl: string;
}

interface AllSectionsCompleteEmail {
  to: string;             // Operator Admin
  toName: string;
  siteName: string;
  operatorName: string;
  reviewUrl: string;
}

interface SurveyClosedEmail {
  to: string;
  toName: string;
  siteName: string;
  closedByName: string;
  reviewUrl: string;
}

interface SurveyReopenedEmail {
  to: string;
  toName: string;
  siteName: string;
  reopenedByName: string;
  surveyUrl: string;
}

interface DelegationCancelledEmail {
  to: string;             // the delegate
  toName: string | null;
  delegatorName: string;
  questionLabel: string;
  siteName: string;
}

interface BounceAlertEmail {
  to: string;             // the operator admin (or platform admin)
  toName: string;
  bouncedEmail: string;
  bouncedRespondentName: string;
  operatorName: string;
  teamUrl: string | null;
}

const FROM_DEFAULT = "Hotel ESG Survey <invites@mail.digitalrain.cloud>";

function getFrom(): string {
  return process.env.RESEND_FROM ?? FROM_DEFAULT;
}

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

const banner = (title: string) =>
  `\n${"=".repeat(64)}\n📧 [STUB MAILER] ${title}\n${"=".repeat(64)}`;

// --- Operator (Platform Admin) login link ----------------------------------

export async function sendOperatorLoginEmail(args: OperatorLoginEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner("Operator login link"));
    console.log(`To:   ${args.email}`);
    console.log(`Link: ${args.magicLink}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }

  await resend.emails.send({
    from: getFrom(),
    to: args.email,
    subject: "Your platform admin sign-in link",
    text: operatorLoginText(args),
    html: operatorLoginHtml(args),
  });
}

function operatorLoginText({ magicLink }: OperatorLoginEmail) {
  return [
    "Hi,",
    "",
    "Here's your one-time sign-in link for the Hotel Energy & ESG Survey platform admin console.",
    "",
    magicLink,
    "",
    "The link is valid for 15 minutes. If you didn't request this, you can safely ignore this email.",
  ].join("\n");
}

function operatorLoginHtml({ magicLink }: OperatorLoginEmail) {
  return baseHtml({
    preheader: "Sign-in link for the platform admin console",
    body: `
      <h1 style="font:600 22px/1.3 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Your sign-in link</h1>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        Here's your one-time link for the platform admin console.
      </p>
      ${ctaButton(magicLink, "Sign in to the console")}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 0">
        Valid for 15 minutes. If you didn't request this, ignore this email.
      </p>
    `,
  });
}

// --- Survey invitation (for Operator Admins + their team members) ----------

export async function sendInvitationEmail(args: InvitationEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Survey invitation — ${args.siteName}`));
    console.log(`To:    ${args.toName} <${args.to}>`);
    console.log(`From:  ${args.inviterName}`);
    console.log(`Role:  ${args.roleLabel}`);
    console.log(`Link:  ${args.magicLink}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }

  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `${args.inviterName} has asked you to take an energy survey for ${args.siteName}`,
    text: invitationText(args),
    html: invitationHtml(args),
  });
}

function invitationText(args: InvitationEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `${args.inviterName} has invited you to take part in an energy survey for ${args.siteName}.`,
    "",
    `Your section: ${args.roleLabel}`,
    "",
    "Open the survey with your personal link below:",
    args.magicLink,
    "",
    "The link is one-time-use and bound to whichever device you first open it on. You can save your progress at any point and come back through the same link.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function invitationHtml(args: InvitationEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `${args.inviterName} has asked you to fill in an energy survey for ${args.siteName}.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.inviterName)}</strong> has invited you to take part in an
        energy survey for <strong>${escapeHtml(args.siteName)}</strong>.
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 20px">
        Your section: <strong>${escapeHtml(args.roleLabel)}</strong>
      </p>
      ${ctaButton(args.magicLink, "Open my survey")}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 8px">
        Your link is personal to you and bound to the first device that opens it.
        You can save your progress at any point and come back through the same
        link.
      </p>
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:0">
        Thanks,<br/>Hotel Energy &amp; ESG Survey team
      </p>
    `,
  });
}

// --- Self-service recovery (lost-link replacement) -------------------------

export async function sendRecoveryEmail(args: RecoveryEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Recovery link — ${args.siteName}`));
    console.log(`To:    ${args.toName} <${args.to}>`);
    console.log(`Role:  ${args.roleLabel}`);
    console.log(`Link:  ${args.magicLink}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }

  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `Your fresh survey link for ${args.siteName}`,
    text: recoveryText(args),
    html: recoveryHtml(args),
  });
}

function recoveryText(args: RecoveryEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `You asked for a fresh link for the energy survey at ${args.siteName}.`,
    "",
    `Your section: ${args.roleLabel}`,
    "",
    "Open the survey with your new link below. The old link is now invalid.",
    args.magicLink,
    "",
    "This link is one-time-use and will bind to whichever device you open it on first. If you didn't request this, you can safely ignore this email.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function recoveryHtml(args: RecoveryEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `A fresh survey link for ${args.siteName}. Your old link is now invalid.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        You asked for a fresh link for the energy survey at
        <strong>${escapeHtml(args.siteName)}</strong>. Your old link is now invalid.
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 20px">
        Your section: <strong>${escapeHtml(args.roleLabel)}</strong>
      </p>
      ${ctaButton(args.magicLink, "Open my survey")}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 8px">
        This link is personal to you and will bind to the first device you open it on.
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:0">
        Thanks,<br/>Hotel Energy &amp; ESG Survey team
      </p>
    `,
  });
}

// --- Welcome email (first-time Operator Admin from /admin) -----------------

export async function sendWelcomeEmail(args: WelcomeEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Welcome — ${args.operatorName}`));
    console.log(`To:    ${args.toName} <${args.to}>`);
    console.log(`Link:  ${args.magicLink}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `Welcome to the Hotel Energy & ESG Survey — set up ${args.operatorName}`,
    text: welcomeText(args),
    html: welcomeHtml(args),
  });
}

function welcomeText(args: WelcomeEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `${args.inviterName} has set up an account for ${args.operatorName} on the Hotel Energy & ESG Survey platform.`,
    "",
    "You're the Operator Admin — the person who'll add your hotel(s), invite your team, and run the survey.",
    "",
    "Click the link below to sign in. The first time you land in your portal, we'll walk you through a 2-minute setup:",
    "  1. Name your hotel and add its address",
    "  2. List your buildings",
    "  3. Invite the people on your team who'll fill different sections",
    "  4. Open the survey",
    "",
    args.magicLink,
    "",
    "The link is one-time-use and binds to whichever device you first open it on. Save your progress at any point and come back through the same link.",
    "",
    "Any questions, just reply to this email.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function welcomeHtml(args: WelcomeEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `Your Operator Admin account for ${args.operatorName} is ready.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.inviterName)}</strong> has set up an account
        for <strong>${escapeHtml(args.operatorName)}</strong> on the Hotel
        Energy &amp; ESG Survey platform.
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        You're the Operator Admin — the person who'll add your hotel(s),
        invite your team, and run the survey.
      </p>
      <p style="font:400 14px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 8px">
        Click below to sign in. The first time you land in your portal, we'll
        walk you through a 2-minute setup:
      </p>
      <ol style="font:400 14px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 20px;padding-left:20px">
        <li>Name your hotel and add its address</li>
        <li>List your buildings</li>
        <li>Invite the people on your team</li>
        <li>Open the survey</li>
      </ol>
      ${ctaButton(args.magicLink, "Sign in and set up my hotel")}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 8px">
        Your link is personal to you and binds to the first device you open
        it on. You can save your progress at any point and come back through
        the same link.
      </p>
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:0">
        Any questions, just reply to this email.<br/>Hotel Energy &amp; ESG
        Survey team
      </p>
    `,
  });
}

// --- Auto-reminders (5/10/21-day cadence) ----------------------------------

const REMINDER_SUBJECTS: Record<1 | 2 | 3, string> = {
  1: "A quick nudge on your energy survey",
  2: "Could you spare 30 minutes for the energy survey?",
  3: "Final reminder — energy survey closing soon",
};

export async function sendReminderEmail(args: ReminderEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Reminder tier ${args.tier} — ${args.siteName}`));
    console.log(`To:    ${args.toName} <${args.to}>`);
    console.log(`Role:  ${args.roleLabel}`);
    console.log(`Link:  ${args.magicLink}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }

  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: REMINDER_SUBJECTS[args.tier],
    text: reminderText(args),
    html: reminderHtml(args),
  });
}

function reminderBodyText(tier: 1 | 2 | 3, siteName: string): string {
  switch (tier) {
    case 1:
      return `Just a friendly nudge — your energy survey for ${siteName} is still waiting on your input. It should only take about 30 minutes, and your answers help your operator find quick efficiency wins.`;
    case 2:
      return `Your energy survey for ${siteName} hasn't been completed yet. Could you find 30 minutes this week? The data you provide is the foundation of the savings report your team will receive.`;
    case 3:
      return `This is the final reminder for the energy survey at ${siteName}. The survey window is closing soon. If you can't complete it personally, please pass this link to someone on your team who can.`;
  }
}

function reminderBodyHtml(tier: 1 | 2 | 3, siteName: string): string {
  const safe = escapeHtml(siteName);
  switch (tier) {
    case 1:
      return `Just a friendly nudge — your energy survey for <strong>${safe}</strong> is still waiting on your input. It should only take about 30 minutes, and your answers help your operator find quick efficiency wins.`;
    case 2:
      return `Your energy survey for <strong>${safe}</strong> hasn't been completed yet. Could you find 30 minutes this week? The data you provide is the foundation of the savings report your team will receive.`;
    case 3:
      return `This is the <strong>final reminder</strong> for the energy survey at <strong>${safe}</strong>. The survey window is closing soon. If you can't complete it personally, please pass this link to someone on your team who can.`;
  }
}

function reminderText(args: ReminderEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    reminderBodyText(args.tier, args.siteName),
    "",
    `Your section: ${args.roleLabel}`,
    "",
    "Pick up where you left off:",
    args.magicLink,
    "",
    "Your progress is saved automatically. Click the link any time on the device you've been using.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function reminderHtml(args: ReminderEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  const ctaLabel = args.tier === 3 ? "Open the survey now" : "Open my survey";
  return baseHtml({
    preheader: REMINDER_SUBJECTS[args.tier],
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        ${reminderBodyHtml(args.tier, args.siteName)}
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 20px">
        Your section: <strong>${escapeHtml(args.roleLabel)}</strong>
      </p>
      ${ctaButton(args.magicLink, ctaLabel)}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 0">
        Your progress is saved automatically. Click the link any time on the
        device you've been using.
      </p>
    `,
  });
}

// --- Question delegation ---------------------------------------------------

export async function sendDelegationEmail(args: DelegationEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Delegation — ${args.siteName}`));
    console.log(`To:        ${args.toName ?? "(no name)"} <${args.to}>`);
    console.log(`From:      ${args.delegatorName}`);
    console.log(`Question:  ${args.questionLabel}`);
    if (args.note) console.log(`Note:      ${args.note}`);
    console.log(`Link:      ${args.magicLink}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `${args.delegatorName} needs your input on one question — ${args.siteName}`,
    text: delegationText(args),
    html: delegationHtml(args),
  });
}

function delegationText(args: DelegationEmail) {
  const greet = args.toName ? `Hi ${args.toName.split(" ")[0]}` : "Hi";
  return [
    `${greet},`,
    "",
    `${args.delegatorName} is filling in the energy survey for ${args.siteName} and needs your help with one question:`,
    "",
    `  "${args.questionLabel}"`,
    "",
    args.note ? `Their note: ${args.note}` : "",
    args.note ? "" : "",
    "It should take less than a minute. Open the question with the link below:",
    args.magicLink,
    "",
    "If you don't know the answer either, you can pass the question on to someone else from the same page.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function delegationHtml(args: DelegationEmail) {
  const greet = args.toName
    ? `Hi ${escapeHtml(args.toName.split(" ")[0])}`
    : "Hi";
  return baseHtml({
    preheader: `${args.delegatorName} needs your input on one question for ${args.siteName}.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">${greet},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.delegatorName)}</strong> is filling in the
        energy survey for <strong>${escapeHtml(args.siteName)}</strong> and
        needs your help with one question:
      </p>
      <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #2F5D50;background:#f4f1e6;font:500 15px/1.45 system-ui,-apple-system,sans-serif;color:#1f2421">
        ${escapeHtml(args.questionLabel)}
      </blockquote>
      ${
        args.note
          ? `<p style="font:400 14px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px"><em>${escapeHtml(args.delegatorName)} added: ${escapeHtml(args.note)}</em></p>`
          : ""
      }
      <p style="font:400 14px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        It should take less than a minute. Open the question below:
      </p>
      ${ctaButton(args.magicLink, "Answer this question")}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 0">
        Don't know the answer either? Pass the question on to someone better
        placed from the same page.
      </p>
    `,
  });
}

export async function sendDelegationCompletedEmail(args: DelegationCompletedEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Delegation answered — ${args.siteName}`));
    console.log(`To:        ${args.toName} <${args.to}>`);
    console.log(`Answered:  ${args.questionLabel}`);
    console.log(`By:        ${args.delegateEmail}`);
    console.log(`Survey:    ${args.surveyUrl}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `${args.delegateEmail} answered the question you delegated`,
    text: delegationCompletedText(args),
    html: delegationCompletedHtml(args),
  });
}

function delegationCompletedText(args: DelegationCompletedEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return [
    `Hi ${firstName},`,
    "",
    `${args.delegateEmail} has answered the question you delegated for ${args.siteName}:`,
    "",
    `  "${args.questionLabel}"`,
    "",
    "Open the survey to see their answer:",
    args.surveyUrl,
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function delegationCompletedHtml(args: DelegationCompletedEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `${args.delegateEmail} answered your delegated question.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.delegateEmail)}</strong> has answered the
        question you delegated for <strong>${escapeHtml(args.siteName)}</strong>:
      </p>
      <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #2F5D50;background:#f4f1e6;font:500 15px/1.45 system-ui,-apple-system,sans-serif;color:#1f2421">
        ${escapeHtml(args.questionLabel)}
      </blockquote>
      ${ctaButton(args.surveyUrl, "See their answer")}
    `,
  });
}

// --- Progress events: section submitted, all sections complete ------------

export async function sendSectionSubmittedEmail(args: SectionSubmittedEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Section submitted — ${args.siteName}`));
    console.log(`To:        ${args.toName} <${args.to}>`);
    console.log(`Submitter: ${args.submitterName}`);
    console.log(`Section:   ${args.sectionTitle}`);
    console.log(`Progress:  ${args.progressUrl}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `${args.submitterName} submitted: ${args.sectionTitle} — ${args.siteName}`,
    text: sectionSubmittedText(args),
    html: sectionSubmittedHtml(args),
  });
}

function sectionSubmittedText(args: SectionSubmittedEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `${args.submitterName} has just submitted the "${args.sectionTitle}" section of the energy survey for ${args.siteName}.`,
    "",
    "See where the rest of your team is up to:",
    args.progressUrl,
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function sectionSubmittedHtml(args: SectionSubmittedEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `${args.submitterName} submitted ${args.sectionTitle}.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.submitterName)}</strong> has just submitted the
        <strong>${escapeHtml(args.sectionTitle)}</strong> section of the energy survey
        for <strong>${escapeHtml(args.siteName)}</strong>.
      </p>
      ${ctaButton(args.progressUrl, "See team progress")}
    `,
  });
}

export async function sendAllSectionsCompleteEmail(args: AllSectionsCompleteEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`All sections complete — ${args.siteName}`));
    console.log(`To:     ${args.toName} <${args.to}>`);
    console.log(`Review: ${args.reviewUrl}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `Your team has finished the energy survey for ${args.siteName}`,
    text: allSectionsCompleteText(args),
    html: allSectionsCompleteHtml(args),
  });
}

function allSectionsCompleteText(args: AllSectionsCompleteEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `Every section of the energy survey for ${args.siteName} has now been submitted by your team.`,
    "",
    "Review what they sent, generate a report, and close the survey when you're happy:",
    args.reviewUrl,
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function allSectionsCompleteHtml(args: AllSectionsCompleteEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `Every section of the survey for ${args.siteName} is now submitted.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        🎉 Every section of the energy survey for
        <strong>${escapeHtml(args.siteName)}</strong> has now been submitted by your team.
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 20px">
        From here, you can review what they sent, generate a report, and close
        the survey when you're satisfied.
      </p>
      ${ctaButton(args.reviewUrl, "Review and finalise")}
    `,
  });
}

// --- Survey lifecycle: closed, reopened ------------------------------------

export async function sendSurveyClosedEmail(args: SurveyClosedEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Survey closed — ${args.siteName}`));
    console.log(`To:     ${args.toName} <${args.to}>`);
    console.log(`Closed: by ${args.closedByName}`);
    console.log(`Review: ${args.reviewUrl}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `Energy survey for ${args.siteName} is now closed`,
    text: surveyClosedText(args),
    html: surveyClosedHtml(args),
  });
}

function surveyClosedText(args: SurveyClosedEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `The energy survey for ${args.siteName} has been closed by ${args.closedByName}.`,
    "",
    "Your answers have been saved. You can still review them through your original link:",
    args.reviewUrl,
    "",
    "If you think it was closed too soon, ask your Operator Admin to reopen it.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function surveyClosedHtml(args: SurveyClosedEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `The energy survey for ${args.siteName} has been closed.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        The energy survey for <strong>${escapeHtml(args.siteName)}</strong> has been
        closed by <strong>${escapeHtml(args.closedByName)}</strong>.
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 20px">
        Your answers have been saved. You can still review them through your
        original link.
      </p>
      ${ctaButton(args.reviewUrl, "Review my answers")}
      <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:24px 0 0">
        If you think it was closed too soon, ask your Operator Admin to reopen it.
      </p>
    `,
  });
}

export async function sendSurveyReopenedEmail(args: SurveyReopenedEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Survey reopened — ${args.siteName}`));
    console.log(`To:       ${args.toName} <${args.to}>`);
    console.log(`Reopened: by ${args.reopenedByName}`);
    console.log(`Survey:   ${args.surveyUrl}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `Energy survey for ${args.siteName} is open again`,
    text: surveyReopenedText(args),
    html: surveyReopenedHtml(args),
  });
}

function surveyReopenedText(args: SurveyReopenedEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `${args.reopenedByName} has reopened the energy survey for ${args.siteName}.`,
    "",
    "You can return through your original link to make edits:",
    args.surveyUrl,
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function surveyReopenedHtml(args: SurveyReopenedEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `${args.reopenedByName} reopened the survey for ${args.siteName}.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.reopenedByName)}</strong> has reopened the energy
        survey for <strong>${escapeHtml(args.siteName)}</strong>. You can return to
        make edits.
      </p>
      ${ctaButton(args.surveyUrl, "Open the survey")}
    `,
  });
}

// --- Delegation cancelled --------------------------------------------------

export async function sendDelegationCancelledEmail(args: DelegationCancelledEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Delegation cancelled — ${args.siteName}`));
    console.log(`To:       ${args.toName ?? "(no name)"} <${args.to}>`);
    console.log(`Question: ${args.questionLabel}`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `${args.delegatorName} no longer needs your input on that question`,
    text: delegationCancelledText(args),
    html: delegationCancelledHtml(args),
  });
}

function delegationCancelledText(args: DelegationCancelledEmail) {
  const greet = args.toName ? `Hi ${args.toName.split(" ")[0]}` : "Hi";
  return [
    `${greet},`,
    "",
    `${args.delegatorName} has withdrawn the question they sent you earlier for ${args.siteName}:`,
    "",
    `  "${args.questionLabel}"`,
    "",
    "No action is needed from you. The link you received is no longer active.",
    "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ].join("\n");
}

function delegationCancelledHtml(args: DelegationCancelledEmail) {
  const greet = args.toName
    ? `Hi ${escapeHtml(args.toName.split(" ")[0])}`
    : "Hi";
  return baseHtml({
    preheader: `${args.delegatorName} no longer needs your input on that question.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">${greet},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        <strong>${escapeHtml(args.delegatorName)}</strong> has withdrawn the
        question they sent you earlier for
        <strong>${escapeHtml(args.siteName)}</strong>:
      </p>
      <blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid #999;background:#f4f1e6;font:500 15px/1.45 system-ui,-apple-system,sans-serif;color:#1f2421">
        ${escapeHtml(args.questionLabel)}
      </blockquote>
      <p style="font:400 14px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 0">
        No action is needed from you. The link you received is no longer active.
      </p>
    `,
  });
}

// --- Bounce alert (Resend webhook) ----------------------------------------

export async function sendBounceAlertEmail(args: BounceAlertEmail) {
  const resend = getResend();
  if (!resend) {
    console.log(banner(`Bounce alert — ${args.operatorName}`));
    console.log(`To:       ${args.toName} <${args.to}>`);
    console.log(`Bounced:  ${args.bouncedRespondentName} <${args.bouncedEmail}>`);
    console.log(`${"=".repeat(64)}\n`);
    return;
  }
  await resend.emails.send({
    from: getFrom(),
    to: args.to,
    subject: `Email to ${args.bouncedEmail} is bouncing`,
    text: bounceAlertText(args),
    html: bounceAlertHtml(args),
  });
}

function bounceAlertText(args: BounceAlertEmail) {
  return [
    `Hi ${args.toName.split(" ")[0] || args.toName},`,
    "",
    `Email to ${args.bouncedRespondentName} <${args.bouncedEmail}> is bouncing.`,
    "",
    "The platform has stopped sending reminders and invitations to that address. To restore contact, ask them for a fresh email address and re-invite them.",
    args.teamUrl ? `\n  ${args.teamUrl}\n` : "",
    "Thanks,",
    "Hotel Energy & ESG Survey team",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function bounceAlertHtml(args: BounceAlertEmail) {
  const firstName = args.toName.split(" ")[0] || args.toName;
  return baseHtml({
    preheader: `Email to ${args.bouncedEmail} is bouncing — reminders are paused.`,
    body: `
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">Hi ${escapeHtml(firstName)},</p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        Email to <strong>${escapeHtml(args.bouncedRespondentName)}</strong>
        &lt;${escapeHtml(args.bouncedEmail)}&gt; is bouncing.
      </p>
      <p style="font:400 15px/1.5 system-ui,-apple-system,sans-serif;color:#1f2421;margin:0 0 16px">
        The platform has stopped sending reminders and invitations to that
        address. To restore contact, ask them for a fresh email address and
        re-invite them through your team page.
      </p>
      ${args.teamUrl ? ctaButton(args.teamUrl, "Open team management") : ""}
    `,
  });
}

// --- Shared HTML scaffolding -----------------------------------------------

function baseHtml({ preheader, body }: { preheader: string; body: string }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Hotel Energy &amp; ESG Survey</title></head>
<body style="margin:0;padding:0;background:#fafaf7;font:400 15px/1.5 system-ui,-apple-system,'Inter',Segoe UI,sans-serif;color:#1f2421">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0">${escapeHtml(preheader)}</span>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fafaf7">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e6e3da;border-radius:12px">
        <tr><td style="padding:32px">
          <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px">
            <span style="display:inline-block;background:#2F5D50;color:#fff;width:28px;height:28px;border-radius:8px;text-align:center;line-height:28px;font:600 14px Georgia,serif">e</span>
            <span style="font:600 14px system-ui,-apple-system,sans-serif;color:#1f2421">Hotel Energy &amp; ESG Survey</span>
          </div>
          ${body}
        </td></tr>
      </table>
      <p style="font:400 12px/1.5 system-ui,-apple-system,sans-serif;color:#999;margin:16px 0 0">
        If you weren't expecting this email, you can safely ignore it.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(href: string, label: string) {
  return `
    <p style="margin:0 0 8px">
      <a href="${escapeHtml(href)}"
         style="display:inline-block;background:#2F5D50;color:#ffffff;text-decoration:none;font:600 15px/1 system-ui,-apple-system,sans-serif;padding:14px 22px;border-radius:8px">
        ${escapeHtml(label)}
      </a>
    </p>
    <p style="font:400 13px/1.5 system-ui,-apple-system,sans-serif;color:#666;margin:0 0 0">
      Or copy &amp; paste this link into your browser:<br/>
      <a href="${escapeHtml(href)}" style="color:#2F5D50;word-break:break-all">${escapeHtml(href)}</a>
    </p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
