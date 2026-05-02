// Mailer — stubbed in Phase 0.C. Real Resend implementation in Phase 0.D once
// API keys + verified sub-zone are in place. The function signatures will not
// change; only the `actuallySend()` body gets replaced.

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

const banner = (title: string) =>
  `\n${"=".repeat(64)}\n📧 [STUB MAILER] ${title}\n${"=".repeat(64)}`;

export async function sendOperatorLoginEmail(args: OperatorLoginEmail) {
  if (process.env.RESEND_API_KEY) {
    // TODO Phase 0.D: real send via Resend.
  }
  console.log(banner("Operator login link"));
  console.log(`To:   ${args.email}`);
  console.log(`Link: ${args.magicLink}`);
  console.log(`${"=".repeat(64)}\n`);
}

export async function sendInvitationEmail(args: InvitationEmail) {
  if (process.env.RESEND_API_KEY) {
    // TODO Phase 0.D: real send via Resend.
  }
  console.log(banner(`Survey invitation — ${args.siteName}`));
  console.log(`To:    ${args.toName} <${args.to}>`);
  console.log(`From:  ${args.inviterName}`);
  console.log(`Role:  ${args.roleLabel}`);
  console.log(`Link:  ${args.magicLink}`);
  console.log(`${"=".repeat(64)}\n`);
}
