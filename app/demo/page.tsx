import { Suspense } from "react";
import Link from "next/link";
import { DemoRouter } from "@/components/form/DemoRouter";
import { formSpec } from "@/lib/form-data";

export const metadata = {
  title: "Demo · PHS Energy",
  description: "Try the survey end-to-end — no sign-in, no data leaves your browser.",
};

/**
 * Public demo of the survey. Same UI a real respondent sees, but Zustand-
 * backed (localStorage only) so nothing is ever sent to the server. Useful
 * for sales pitches + a "see what it looks like" link from the marketing
 * landing.
 */
export default function DemoPage() {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="text-xs font-medium">phs</span>
            </div>
            <div>
              <p className="font-display text-lg leading-tight text-ink">
                {formSpec.meta.title}
              </p>
              <p className="text-xs text-muted">{formSpec.meta.subtitle}</p>
            </div>
          </Link>
          <span className="rounded-control border border-accent/40 bg-accent-soft/40 px-3 py-1 text-xs text-accent-deep">
            Demo · nothing is sent to the server
          </span>
        </div>
      </header>
      <Suspense fallback={null}>
        <DemoRouter />
      </Suspense>
    </div>
  );
}
