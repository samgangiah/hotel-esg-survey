import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AdminNav } from "@/components/admin/AdminNav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Platform admin" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const me = await requirePlatformAdmin();

  const operators = await db.operator.findMany({
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

  const totalSites = operators.reduce((acc, o) => acc + o.sites.length, 0);
  const totalInstances = operators.reduce(
    (acc, o) => acc + o.sites.reduce((a, s) => a + s.surveyInstances.length, 0),
    0
  );

  return (
    <>
      <AdminNav active="/admin" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Operators
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink">
              Hello, {me.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {operators.length} operator{operators.length === 1 ? "" : "s"} ·{" "}
              {totalSites} site{totalSites === 1 ? "" : "s"} ·{" "}
              {totalInstances} survey instance{totalInstances === 1 ? "" : "s"}
            </p>
          </div>
          <Link href="/admin/operators/new">
            <Button size="lg">
              <Plus className="h-4 w-4" /> Add an operator
            </Button>
          </Link>
        </header>

        {operators.length === 0 ? (
          <Card className="space-y-3 p-8 text-center">
            <h2 className="font-display text-xl text-ink">No operators yet</h2>
            <p className="text-sm text-muted">
              Add a new operator to spin up their first site, building, and Operator
              Admin invite — all in one step.
            </p>
            <div>
              <Link href="/admin/operators/new">
                <Button variant="secondary">
                  <Plus className="h-4 w-4" /> Add an operator
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {operators.map((o) => (
              <Link
                key={o.id}
                href={`/admin/operators/${o.id}`}
                className="block"
              >
                <Card className="p-6 transition-shadow hover:shadow-card">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl text-ink">{o.name}</h2>
                      <p className="text-xs text-muted">
                        {o.sites.length} site{o.sites.length === 1 ? "" : "s"} ·{" "}
                        {o._count.respondents} respondent
                        {o._count.respondents === 1 ? "" : "s"} ·{" "}
                        {o.sites.reduce(
                          (a, s) => a + s.surveyInstances.length,
                          0
                        )}{" "}
                        instance
                        {o.sites.reduce(
                          (a, s) => a + s.surveyInstances.length,
                          0
                        ) === 1
                          ? ""
                          : "s"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </div>
                  {o.sites.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {o.sites.slice(0, 4).map((s) => {
                        const inst = s.surveyInstances[0];
                        return (
                          <li
                            key={s.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
                          >
                            <span className="text-ink">{s.name}</span>
                            <span className="text-xs text-muted">
                              {inst
                                ? `${inst.status} · ${s.buildings.length} bldg`
                                : "no survey yet"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
