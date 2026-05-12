import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AdminNav } from "@/components/admin/AdminNav";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { addOperator } from "./actions";

export const metadata = { title: "Add an operator" };
export const dynamic = "force-dynamic";

export default async function NewOperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    const result = await addOperator({
      operatorName: String(formData.get("operatorName") ?? "").trim(),
      adminName: String(formData.get("adminName") ?? "").trim(),
      adminEmail: String(formData.get("adminEmail") ?? "").trim().toLowerCase(),
    });
    if (!result.ok) {
      redirect(`/admin/operators/new?err=${encodeURIComponent(result.error)}`);
    }
    redirect(`/admin/operators/${result.operatorId}`);
  }

  return (
    <>
      <AdminNav active="/admin" />
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <Link href="/admin" className="text-sm text-muted hover:text-ink">
            ← Back to operators
          </Link>
        </div>

        <h1 className="font-display text-3xl text-ink">Add an operator</h1>
        <p className="mt-2 text-muted">
          You only need three things: the company name and the Operator
          Admin's name + email. They'll set up their hotel, buildings, and
          team themselves through a guided wizard the first time they sign in.
        </p>

        <Card className="mt-6">
          <form action={submit} className="space-y-6 p-6 sm:p-8">
            <div className="space-y-1.5">
              <label
                htmlFor="operatorName"
                className="text-sm font-medium text-ink"
              >
                Operator name
              </label>
              <Input
                id="operatorName"
                name="operatorName"
                required
                autoFocus
                placeholder="e.g. Cairn Group"
              />
              <p className="text-xs text-muted">
                The company / hotel group. The customer can rename this later.
              </p>
            </div>

            <div className="space-y-4 border-t border-line pt-6">
              <h2 className="font-display text-lg text-ink">Operator Admin</h2>
              <p className="text-sm text-muted">
                One person at the operator who'll receive the welcome email
                and run the setup.
              </p>
              <div className="space-y-1.5">
                <label
                  htmlFor="adminName"
                  className="text-sm font-medium text-ink"
                >
                  Name
                </label>
                <Input
                  id="adminName"
                  name="adminName"
                  required
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="adminEmail"
                  className="text-sm font-medium text-ink"
                >
                  Email
                </label>
                <Input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  required
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            {sp.err && <p className="text-sm text-danger">{sp.err}</p>}

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg">
                Create + send welcome email
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
