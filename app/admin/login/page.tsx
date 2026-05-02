import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPlatformAdminLogin } from "./actions";

export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";

  async function submit(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const result = await requestPlatformAdminLogin(email);
    if (!result.ok) {
      redirect(`/admin/login?err=${encodeURIComponent(result.error)}`);
    }
    redirect("/admin/login?sent=1");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <Card className="space-y-5 p-8 sm:p-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Platform admin</p>
          <h1 className="mt-2 font-display text-3xl text-ink">Sign in</h1>
        </div>

        {sent ? (
          <div className="space-y-3">
            <p className="text-ink">Check your email for a sign-in link.</p>
            <p className="text-sm text-muted">
              Valid for 15 minutes. In this Phase 0 build, links also appear in
              the container logs:{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px]">
                docker logs esg-app
              </code>
              .
            </p>
          </div>
        ) : (
          <form action={submit} className="space-y-4">
            <p className="text-sm text-muted">
              Sign in with the platform-admin email registered for this instance.
              We'll email you a one-time link.
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
