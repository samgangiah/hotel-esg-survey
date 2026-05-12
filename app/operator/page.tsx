import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Plus,
  ShieldCheck,
  Users as UsersIcon,
  Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { OperatorNav } from "@/components/operator/OperatorNav";
import { CloseSurveyButton } from "@/components/operator/CloseSurveyButton";
import { GenerateReportButton } from "@/components/operator/GenerateReportButton";
import { SetupWizard } from "@/components/operator/SetupWizard";
import { EditOperatorName } from "@/components/operator/EditOperatorName";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import { ROLE_LABELS, type RoleKey } from "@/lib/roles";
import { closeInstance, reopenInstance, updateOperatorName } from "./actions";
import { generateReport } from "./reports/actions";
import { updateSite, addBuilding } from "./sites/[siteId]/actions";

export const metadata = { title: "Operator dashboard" };
export const dynamic = "force-dynamic";

export default async function OperatorDashboard() {
  const me = await requireOperatorAdmin();

  const operator = await db.operator.findUnique({
    where: { id: me.operatorId },
    include: {
      sites: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          buildings: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
          },
          surveyInstances: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      respondents: {
        where: { deletedAt: null },
        orderBy: [{ isOperatorAdmin: "desc" }, { createdAt: "asc" }],
        include: {
          assignments: true,
        },
      },
    },
  });
  if (!operator) return null;

  const totalBuildings = operator.sites.reduce(
    (a, s) => a + s.buildings.length,
    0
  );

  // First-run setup wizard: shown when the customer hasn't yet renamed
  // their placeholder hotel. The dashboard takes over once they do.
  if (operator.setupCompletedAt === null) {
    const firstSite = operator.sites[0];
    if (firstSite) {
      const firstInstance = firstSite.surveyInstances[0];
      return (
        <>
          <OperatorNav active="/operator" operatorName={me.operatorName} />
          <SetupWizard
            operatorName={me.operatorName}
            respondentName={me.name}
            site={{
              id: firstSite.id,
              name: firstSite.name,
              address: firstSite.address,
              buildings: firstSite.buildings.map((b) => ({
                id: b.id,
                name: b.name,
                isPrimary: b.id === firstSite.primaryBuildingId,
              })),
            }}
            surveyInstanceId={firstInstance?.id ?? ""}
            teamCount={operator.respondents.length}
            onSaveSite={updateSite}
            onAddBuilding={addBuilding}
            onRenameOperator={updateOperatorName}
          />
        </>
      );
    }
  }

  return (
    <>
      <OperatorNav active="/operator" operatorName={me.operatorName} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-wide text-muted">Welcome</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Hello, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            You're managing the energy survey for{" "}
            <EditOperatorName
              currentName={me.operatorName}
              onSave={updateOperatorName}
            />
            . {operator.sites.length} site{operator.sites.length === 1 ? "" : "s"}{" "}
            · {totalBuildings} building{totalBuildings === 1 ? "" : "s"} ·{" "}
            {operator.respondents.length} respondent
            {operator.respondents.length === 1 ? "" : "s"}.
          </p>
        </header>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Sites & buildings</h2>
          </div>
          <Card className="divide-y divide-line">
            {operator.sites.map((s) => {
              const inst = s.surveyInstances[0];
              return (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/operator/sites/${s.id}`}
                        className="group inline-flex items-center gap-2 font-medium text-ink hover:text-accent-deep"
                      >
                        <Building2 className="h-4 w-4 text-muted group-hover:text-accent" />
                        {s.name}
                        <Pencil className="h-3.5 w-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                      {s.address && (
                        <p className="text-xs text-muted">{s.address}</p>
                      )}
                      <p className="mt-1 text-xs text-muted">
                        {s.buildings.length} building
                        {s.buildings.length === 1 ? "" : "s"}
                        {inst ? (
                          <>
                            {" · status: "}
                            <span className="font-medium text-ink">
                              {inst.status}
                            </span>
                            {inst.lockedAt && (
                              <span>
                                {" · closed "}
                                {inst.lockedAt.toISOString().slice(0, 10)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span> · no instance</span>
                        )}
                      </p>
                    </div>
                    {inst && (
                      <div className="flex flex-col items-end gap-2">
                        <GenerateReportButton
                          instanceId={inst.id}
                          onGenerate={generateReport}
                        />
                        <CloseSurveyButton
                          instanceId={inst.id}
                          status={inst.status}
                          onClose={closeInstance}
                          onReopen={reopenInstance}
                        />
                      </div>
                    )}
                  </div>
                  {s.buildings.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      {s.buildings.map((b) => b.name).join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </Card>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Team</h2>
            <Link href="/operator/team">
              <Button size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" /> Invite a respondent
              </Button>
            </Link>
          </div>
          <Card className="divide-y divide-line">
            {operator.respondents.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-3"
              >
                <span>
                  <span className="font-medium text-ink">{r.name}</span>
                  {r.isOperatorAdmin && (
                    <Pill className="ml-2">
                      <ShieldCheck className="h-3 w-3" /> Operator Admin
                    </Pill>
                  )}
                  <span className="ml-2 text-xs text-muted">{r.email}</span>
                </span>
                <span className="text-xs text-muted">
                  {distinctRoles(r.assignments).join(", ") || "—"}
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg text-ink">Next steps</h2>
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            <NextCard
              title="Add to your team"
              body="Invite the people who can actually answer each section — laundry leads, engineering, housekeeping — so the survey is filled by the right hands."
              href="/operator/team"
              cta="Manage team"
              icon={UsersIcon}
            />
            <NextCard
              title="Track progress"
              body="See who's been invited, who's opened their link, and which sections are still blank."
              href="/operator/progress"
              cta="Open progress"
              icon={ChevronRight}
            />
          </Card>
        </section>
      </div>
    </>
  );
}

function distinctRoles(
  assignments: { role: string }[]
): string[] {
  const set = new Set<string>();
  for (const a of assignments) {
    set.add(ROLE_LABELS[a.role as RoleKey] ?? a.role);
  }
  return Array.from(set);
}

function NextCard({
  title,
  body,
  href,
  cta,
  icon: Icon,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-control border border-line p-4 transition-colors hover:border-accent/40 hover:bg-accent-soft/20"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent-deep">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="mt-1 block text-sm text-muted">{body}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-sm text-accent-deep group-hover:text-accent">
          {cta} <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </Link>
  );
}
