import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus, Trash2, CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OperatorNav } from "@/components/operator/OperatorNav";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import { addBuilding, removeBuilding, updateSite } from "./actions";

export const metadata = { title: "Site" };
export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const me = await requireOperatorAdmin();
  const { siteId } = await params;
  const sp = await searchParams;

  const site = await db.site.findFirst({
    where: { id: siteId, deletedAt: null, operatorId: me.operatorId },
    include: {
      buildings: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { answers: true, assignments: true } } },
      },
      surveyInstances: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!site) notFound();

  async function saveSite(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim() || null;
    const result = await updateSite(siteId, { name, address });
    if (!result.ok)
      redirect(`/operator/sites/${siteId}?err=${encodeURIComponent(result.error)}`);
    redirect(
      `/operator/sites/${siteId}?msg=${encodeURIComponent("Site updated.")}`
    );
  }

  async function addBuildingAction(formData: FormData) {
    "use server";
    const name = String(formData.get("buildingName") ?? "").trim();
    const result = await addBuilding(siteId, name);
    if (!result.ok)
      redirect(`/operator/sites/${siteId}?err=${encodeURIComponent(result.error)}`);
    redirect(
      `/operator/sites/${siteId}?msg=${encodeURIComponent(`Added building "${name}".`)}`
    );
  }

  return (
    <>
      <OperatorNav active="/operator" operatorName={me.operatorName} />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-4">
          <Link
            href="/operator"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
        </div>

        <p className="text-xs uppercase tracking-wide text-muted">Site</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{site.name}</h1>

        {sp.msg && (
          <Card className="mt-4 border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm text-accent-deep">
            <CircleCheck className="mr-2 inline-block h-4 w-4 align-text-bottom" />
            {sp.msg}
          </Card>
        )}
        {sp.err && (
          <Card className="mt-4 border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
            {sp.err}
          </Card>
        )}

        <Card className="mt-6">
          <form action={saveSite} className="space-y-5 p-6 sm:p-8">
            <h2 className="font-display text-lg text-ink">Site details</h2>
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-ink">
                Site name
              </label>
              <Input id="name" name="name" defaultValue={site.name} required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="address" className="text-sm font-medium text-ink">
                Address{" "}
                <span className="text-xs font-normal text-muted">
                  (optional)
                </span>
              </label>
              <Input
                id="address"
                name="address"
                defaultValue={site.address ?? ""}
                placeholder="Street, town, postcode"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save site</Button>
            </div>
          </form>
        </Card>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Buildings</h2>
            <p className="text-xs text-muted">
              {site.buildings.length} on this site
            </p>
          </div>
          <Card className="divide-y divide-line">
            {site.buildings.map((b) => {
              const inUse =
                b._count.answers > 0 || b._count.assignments > 0;
              const isPrimary = b.id === site.primaryBuildingId;
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-3 text-sm"
                >
                  <span>
                    <span className="font-medium text-ink">{b.name}</span>
                    {isPrimary && (
                      <span className="ml-2 text-xs text-muted">(primary)</span>
                    )}
                    {inUse && (
                      <span className="ml-2 text-xs text-muted">in use</span>
                    )}
                  </span>
                  {!isPrimary && !inUse && (
                    <RemoveBuildingButton siteId={siteId} buildingId={b.id} />
                  )}
                </div>
              );
            })}
          </Card>

          <Card className="mt-3">
            <form
              action={addBuildingAction}
              className="flex flex-wrap items-end gap-3 p-4"
            >
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <label
                  htmlFor="buildingName"
                  className="text-sm font-medium text-ink"
                >
                  Add another building
                </label>
                <Input
                  id="buildingName"
                  name="buildingName"
                  required
                  placeholder="e.g. Annexe, North Wing"
                />
              </div>
              <Button type="submit" variant="secondary">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </form>
          </Card>
        </section>
      </div>
    </>
  );
}

function RemoveBuildingButton({
  siteId,
  buildingId,
}: {
  siteId: string;
  buildingId: string;
}) {
  async function action() {
    "use server";
    await removeBuilding(siteId, buildingId);
    redirect(
      `/operator/sites/${siteId}?msg=${encodeURIComponent("Building removed.")}`
    );
  }
  return (
    <form action={action}>
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded p-1 text-xs text-muted hover:bg-canvas hover:text-danger"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Remove
      </button>
    </form>
  );
}
