import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { confirmIdentity, denyIdentity } from "./actions";

export const metadata = { title: "Survey access" };
export const dynamic = "force-dynamic";

export default async function MagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashToken(token);

  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: {
      assignment: {
        include: {
          respondent: true,
          surveyInstance: { include: { site: true } },
          building: true,
        },
      },
      boundSession: true,
    },
  });

  // Token doesn't exist
  if (!invitation) {
    return <ExpiredOrInvalid />;
  }

  // Expired
  if (invitation.expiresAt < new Date()) {
    return <ExpiredOrInvalid />;
  }

  // Already bound to a session — link is single-use across devices.
  if (invitation.boundSessionId && invitation.boundSession) {
    return <AlreadyBound />;
  }

  const a = invitation.assignment;
  const r = a.respondent;
  const site = a.surveyInstance.site;

  const isOperatorAdmin = r.isOperatorAdmin;
  async function yes() {
    "use server";
    const result = await confirmIdentity(token);
    if (!result.ok) redirect(`/r/${token}?err=${encodeURIComponent(result.error)}`);
    // Operator Admins go to their portal; everyone else lands on the survey.
    redirect(isOperatorAdmin ? "/operator" : "/survey");
  }
  async function no() {
    "use server";
    await denyIdentity(token);
    redirect(`/r/${token}/denied`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-5 p-8 sm:p-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Confirm your identity
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">
            Hello {r.name.split(" ")[0]}
          </h1>
        </div>
        <p className="text-ink">
          You've been invited to take part in the energy survey for{" "}
          <span className="font-medium">{site.name}</span>
          {a.role !== "gm" && a.sectionId !== "all" ? (
            <>
              {" "}— specifically the <span className="font-medium">{prettyRole(a.role)}</span> section
              {a.building ? <> for <span className="font-medium">{a.building.name}</span></> : null}.
            </>
          ) : (
            <> as the Site Admin (full access).</>
          )}
        </p>
        <p className="text-sm text-muted">
          By continuing on this device, you'll bind the survey to this browser. The link
          won't open anywhere else after that.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <form action={yes}>
            <Button type="submit" size="lg">
              Yes, that's me — start the survey
            </Button>
          </form>
          <form action={no}>
            <Button type="submit" variant="secondary">
              That's not me
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function ExpiredOrInvalid() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-3 p-8 text-center sm:p-10">
        <h1 className="font-display text-2xl text-ink">Link expired or invalid</h1>
        <p className="text-muted">
          This link is no longer valid. Ask your Site Admin to send a fresh one, or
          recover it yourself below.
        </p>
        <div className="pt-2">
          <Link href="/recover">
            <Button variant="secondary">Recover my link</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function AlreadyBound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-3 p-8 text-center sm:p-10">
        <h1 className="font-display text-2xl text-ink">
          This link has already been opened
        </h1>
        <p className="text-muted">
          The link has been bound to another device or browser. If that wasn't you,
          ask your Site Admin to issue a new link, which will invalidate the previous
          binding.
        </p>
        <div className="pt-2">
          <Link href="/recover">
            <Button variant="secondary">Recover my link</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function prettyRole(role: string): string {
  const map: Record<string, string> = {
    gm: "General Manager",
    engineering: "Engineering / Maintenance",
    housekeeping: "Housekeeping",
    laundry: "Laundry",
    finance: "Finance",
    energy_manager: "Energy / ESG Manager",
  };
  return map[role] ?? role;
}
