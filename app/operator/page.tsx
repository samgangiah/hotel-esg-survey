import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/operator-auth";

export const metadata = { title: "Operator console" };
export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const op = await requireOperator();

  const orgs = await db.organisation.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          buildings: { where: { deletedAt: null } },
          surveyInstances: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      _count: { select: { respondents: true } },
    },
  });

  const totalSites = orgs.reduce((acc, o) => acc + o.sites.length, 0);
  const totalInstances = orgs.reduce(
    (acc, o) => acc + o.sites.reduce((a, s) => a + s.surveyInstances.length, 0),
    0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Operator console</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Hello, {op.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {orgs.length} organisation{orgs.length === 1 ? "" : "s"} ·{" "}
            {totalSites} site{totalSites === 1 ? "" : "s"} ·{" "}
            {totalInstances} survey instance{totalInstances === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/operator/clients/new">
          <Button size="lg">
            <Plus className="h-4 w-4" /> Add a new client
          </Button>
        </Link>
      </header>

      {orgs.length === 0 ? (
        <Card className="space-y-3 p-8 text-center">
          <h2 className="font-display text-xl text-ink">No clients yet</h2>
          <p className="text-sm text-muted">
            Add your first organisation to get started. You'll create the org, its
            site, its buildings, and invite the first Site Admin in one step.
          </p>
          <div>
            <Link href="/operator/clients/new">
              <Button variant="secondary">
                <Plus className="h-4 w-4" /> Add a new client
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {orgs.map((o) => (
            <Card key={o.id} className="p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl text-ink">{o.name}</h2>
                <span className="text-xs text-muted">
                  {o.sites.length} site{o.sites.length === 1 ? "" : "s"} ·{" "}
                  {o._count.respondents} respondent
                  {o._count.respondents === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {o.sites.map((s) => {
                  const inst = s.surveyInstances[0];
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-control border border-line bg-canvas/40 px-4 py-3"
                    >
                      <span>
                        <span className="font-medium text-ink">{s.name}</span>
                        <span className="ml-2 text-xs text-muted">
                          {s.buildings.length} building
                          {s.buildings.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="text-xs text-muted">
                        {inst
                          ? `Latest: ${inst.status} · ${inst.createdAt.toISOString().slice(0, 10)}`
                          : "No survey yet"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
