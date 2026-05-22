import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CircleAlert,
  CircleCheck,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { OperatorNav } from "@/components/operator/OperatorNav";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import { ROLE_KEYS, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/roles";
import { EditTeamMember } from "@/components/operator/EditTeamMember";
import {
  inviteRespondent,
  resendInvitationOp,
  updateRespondentRoles,
  removeRespondent,
} from "./actions";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const me = await requireOperatorAdmin();
  const sp = await searchParams;

  const operator = await db.operator.findUnique({
    where: { id: me.operatorId },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          buildings: { where: { deletedAt: null } },
        },
      },
      respondents: {
        where: { deletedAt: null },
        orderBy: [{ isOperatorAdmin: "desc" }, { createdAt: "asc" }],
        include: {
          assignments: {
            include: {
              building: true,
              invitations: { orderBy: { sentAt: "desc" }, take: 1 },
            },
          },
          sessions: { orderBy: { lastSeenAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!operator) return null;

  const allBuildings = operator.sites.flatMap((s) =>
    s.buildings.map((b) => ({ id: b.id, label: `${s.name} – ${b.name}` }))
  );

  async function inviteAction(formData: FormData) {
    "use server";
    const result = await inviteRespondent({
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      roles: formData
        .getAll("roles")
        .map((v) => String(v))
        .filter((v) => ROLE_KEYS.includes(v as never)),
      buildingIds: formData.getAll("buildings").map((v) => String(v)),
    });
    if (!result.ok)
      redirect(`/operator/team?err=${encodeURIComponent(result.error)}`);
    redirect(
      `/operator/team?msg=${encodeURIComponent(`Invitation sent to ${result.email}.`)}`
    );
  }

  return (
    <>
      <OperatorNav active="/operator/team" operatorName={me.operatorName} />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">Team</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Who's filling in what
          </h1>
          <p className="mt-1 text-sm text-muted">
            Invite the people who actually know each part of the property.
            Each respondent gets a magic-link email and only sees the questions
            relevant to their role.
          </p>
        </header>

        {sp.msg && (
          <Card className="mb-6 border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm text-accent-deep">
            <CircleCheck className="mr-2 inline-block h-4 w-4 align-text-bottom" />
            {sp.msg}
          </Card>
        )}
        {sp.err && (
          <Card className="mb-6 border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
            <CircleAlert className="mr-2 inline-block h-4 w-4 align-text-bottom" />
            {sp.err}
          </Card>
        )}

        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg text-ink">Current team</h2>
          {operator.respondents.length === 0 ? (
            <Card className="px-6 py-8 text-center text-sm text-muted">
              No respondents yet.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {operator.respondents.map((r) => {
                const lastSession = r.sessions[0];
                const distinctRoles = Array.from(
                  new Set(r.assignments.map((a) => a.role))
                );
                const distinctBuildingIds = Array.from(
                  new Set(
                    r.assignments
                      .map((a) => a.buildingId)
                      .filter((b): b is string => b !== null)
                  )
                );
                return (
                  <div key={r.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div>
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-medium text-ink">{r.name}</span>
                          {r.isOperatorAdmin && (
                            <Pill>
                              <ShieldCheck className="h-3 w-3" /> Operator Admin
                            </Pill>
                          )}
                          {r.emailInvalid && (
                            <Pill className="border-danger/40 bg-danger/10 text-danger">
                              <CircleAlert className="h-3 w-3" /> email bounced
                            </Pill>
                          )}
                        </span>
                        <p className="text-xs text-muted">
                          {r.email}
                          {lastSession && (
                            <>
                              {" · last seen "}
                              {timeAgo(lastSession.lastSeenAt)}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {distinctRoles.length === 0
                        ? "No assignments yet"
                        : distinctRoles
                            .map(
                              (k) =>
                                ROLE_LABELS[k as keyof typeof ROLE_LABELS] ?? k
                            )
                            .join(", ")}
                    </p>
                    {r.assignments.length > 0 && !r.isOperatorAdmin && (
                      <>
                        <ResendForm assignmentId={r.assignments[0].id} />
                        <EditTeamMember
                          respondentId={r.id}
                          respondentName={r.name}
                          currentRoles={distinctRoles}
                          currentBuildingIds={distinctBuildingIds}
                          allBuildings={allBuildings}
                          onUpdate={updateRespondentRoles}
                          onRemove={removeRespondent}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg text-ink">
            Invite a respondent
          </h2>
          <Card>
            <form action={inviteAction} className="space-y-6 p-6 sm:p-8">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="name"
                    className="text-sm font-medium text-ink"
                  >
                    Name
                  </label>
                  <Input id="name" name="name" required placeholder="Anna Borejko" />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-ink"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="anna@example.com"
                  />
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">
                  Roles
                  <span className="ml-1 text-xs font-normal text-muted">
                    (pick one or more — they'll see only the questions for these
                    roles)
                  </span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLE_KEYS.map((key) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-white px-4 py-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
                    >
                      <input
                        type="checkbox"
                        name="roles"
                        value={key}
                        className="mt-0.5 h-4 w-4 rounded border-line text-accent focus:ring-accent"
                      />
                      <span>
                        <span className="font-medium text-ink">
                          {ROLE_LABELS[key]}
                        </span>
                        <span className="block text-xs text-muted">
                          {ROLE_DESCRIPTIONS[key]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">
                  Buildings
                  <span className="ml-1 text-xs font-normal text-muted">
                    (which buildings do they cover? Leave all unchecked to give
                    them all buildings)
                  </span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {allBuildings.map((b) => (
                    <label
                      key={b.id}
                      className="flex cursor-pointer items-center gap-3 rounded-control border border-line bg-white px-4 py-2.5 text-sm transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
                    >
                      <input
                        type="checkbox"
                        name="buildings"
                        value={b.id}
                        className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                      />
                      <span className="text-ink">{b.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex justify-end">
                <Button type="submit" size="lg">
                  <UserPlus className="h-4 w-4" /> Send invitation
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <p className="mt-6 text-xs text-muted">
          <Link
            href="/operator"
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </>
  );
}

function ResendForm({ assignmentId }: { assignmentId: string }) {
  async function action() {
    "use server";
    await resendInvitationOp(assignmentId);
    redirect(
      `/operator/team?msg=${encodeURIComponent("New invitation sent — old link invalidated.")}`
    );
  }
  return (
    <form action={action} className="mt-2">
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded p-1 text-xs text-muted hover:bg-canvas hover:text-accent-deep"
      >
        <Send className="h-3 w-3" /> Resend invitation
      </button>
    </form>
  );
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
