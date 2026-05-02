import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requireOperator } from "@/lib/operator-auth";
import { addClient } from "./actions";

export const metadata = { title: "Add a new client" };
export const dynamic = "force-dynamic";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  await requireOperator();
  const sp = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    const result = await addClient({
      organisationName: String(formData.get("organisationName") ?? "").trim(),
      siteName: String(formData.get("siteName") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim() || null,
      buildingNames: String(formData.get("buildings") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      adminName: String(formData.get("adminName") ?? "").trim(),
      adminEmail: String(formData.get("adminEmail") ?? "").trim().toLowerCase(),
    });
    if (!result.ok) {
      redirect(`/operator/clients/new?err=${encodeURIComponent(result.error)}`);
    }
    redirect(`/operator?welcomed=${result.siteId}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Link href="/operator" className="text-sm text-muted hover:text-ink">
          ← Back to console
        </Link>
      </div>

      <h1 className="font-display text-3xl text-ink">Add a new client</h1>
      <p className="mt-2 text-muted">
        Creates the organisation, its first site, its buildings, and invites the
        Site Admin in one step. The invitation goes out as soon as you submit.
      </p>

      <Card className="mt-6">
        <form action={submit} className="space-y-6 p-6 sm:p-8">
          <Section title="Organisation">
            <Field label="Organisation name" htmlFor="organisationName">
              <Input
                id="organisationName"
                name="organisationName"
                required
                placeholder="e.g. Cairn Group"
              />
            </Field>
          </Section>

          <Section title="Site">
            <Field label="Site name" htmlFor="siteName">
              <Input
                id="siteName"
                name="siteName"
                required
                placeholder="e.g. DoubleTree Harrogate"
              />
            </Field>
            <Field label="Address" htmlFor="address" optional>
              <Input
                id="address"
                name="address"
                placeholder="Street, town, postcode"
              />
            </Field>
            <Field
              label="Buildings"
              htmlFor="buildings"
              hint="One per line. Most sites have just one — the building name and the site name can be the same."
            >
              <textarea
                id="buildings"
                name="buildings"
                required
                rows={3}
                placeholder={`Main building\nAnnexe`}
                className="min-h-[88px] w-full rounded-control border border-line bg-white px-3 py-2.5 text-ink transition-shadow focus-visible:shadow-focus focus-visible:border-accent resize-y"
              />
            </Field>
          </Section>

          <Section title="Site Admin (first respondent)">
            <p className="text-sm text-muted">
              This person will get the survey invitation immediately and can invite
              others on their team from their own dashboard.
            </p>
            <Field label="Name" htmlFor="adminName">
              <Input
                id="adminName"
                name="adminName"
                required
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Email" htmlFor="adminEmail">
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                required
                placeholder="jane@example.com"
              />
            </Field>
          </Section>

          {sp.err && <p className="text-sm text-danger">{sp.err}</p>}

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg">
              Create + send invite
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-muted">(optional)</span>
        )}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
