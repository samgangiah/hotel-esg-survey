import { Card } from "@/components/ui/Card";

export const metadata = { title: "Survey access" };

export default async function MagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-4 p-8 text-center sm:p-10">
        <p className="text-xs uppercase tracking-wide text-muted">
          Survey access
        </p>
        <h1 className="font-display text-3xl text-ink">Verifying your invitation…</h1>
        <p className="text-sm text-muted">
          Token recognised. The full magic-link consumer is being wired up in the next
          session — for now this page just confirms the route is alive.
        </p>
        <p className="font-mono text-xs text-muted">
          token: {token.slice(0, 8)}…
        </p>
      </Card>
    </div>
  );
}
