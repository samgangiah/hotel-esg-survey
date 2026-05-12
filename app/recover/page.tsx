import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestRecovery } from "./actions";

export const metadata = { title: "Recover your survey link" };
export const dynamic = "force-dynamic";

/**
 * Self-service magic-link recovery — type your email, we expire any active
 * invitations on your assignments and email you a fresh link. The response
 * page is the same regardless of whether the email is on file, so attackers
 * can't enumerate registered respondents.
 */
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === "1";
  const prefillEmail = typeof sp.email === "string" ? sp.email : "";

  async function submit(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    await requestRecovery(email);
    redirect("/recover?sent=1");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-5 p-8 sm:p-10">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Recover</p>
          <h1 className="mt-2 font-display text-3xl text-ink">
            {sent ? "Check your inbox" : "Lost your link?"}
          </h1>
        </div>

        {sent ? (
          <div className="space-y-3">
            <p className="text-ink">
              If we have your email on file, we've just sent a fresh survey
              link. Your previous link is now invalid.
            </p>
            <p className="text-sm text-muted">
              The new link is valid for 14 days and will bind to whichever
              device you open it on first — so open it on the device you want to
              fill the survey from. If you don't see it within a few minutes,
              check your spam folder.
            </p>
            <div className="pt-2">
              <Link href="/">
                <Button variant="ghost">Back to homepage</Button>
              </Link>
            </div>
          </div>
        ) : (
          <form action={submit} className="space-y-4">
            <p className="text-sm text-muted">
              Enter the email address your invitation was sent to. We'll expire
              your previous link and email you a fresh one.
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
                defaultValue={prefillEmail}
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Email me a fresh link
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
