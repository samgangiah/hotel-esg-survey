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
