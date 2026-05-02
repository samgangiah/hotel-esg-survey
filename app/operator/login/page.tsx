import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestOperatorLogin } from "./actions";

export const metadata = { title: "Operator login" };

export default async function OperatorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";

  async function submit(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const result = await requestOperatorLogin(email);
    if (!result.ok) {
      redirect(`/operator/login?err=${encodeURIComponent(result.error)}`);
    }
    redirect("/operator/login?sent=1");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card className="space-y-5 p-8 sm:p-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Operator</p>
          <h1 className="mt-2 font-display text-3xl text-ink">Sign in</h1>
        </div>

        {sent ? (
          <div className="space-y-3">
            <p className="text-ink">Check your email for a sign-in link.</p>
            <p className="text-sm text-muted">
              The link is valid for 15 minutes. If you don't see it, check spam — or, in
              this Phase 0 build, check the container logs:{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px]">
                docker logs esg-app
              </code>
              .
            </p>
          </div>
        ) : (
          <form action={submit} className="space-y-4">
            <p className="text-sm text-muted">
              Sign in with the operator email registered for this instance. We'll email
              you a one-time link.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-ink">
                Email
              </label>
              <Input
                type="email"
                id="email"
                name="email"
                required
                autoFocus
                placeholder="you@example.com"
              />
            </div>
            {sp.err && <p className="text-sm text-danger">{sp.err}</p>}
            <Button type="submit" size="lg" className="w-full">
              Email me a sign-in link
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
