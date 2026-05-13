import { Suspense } from "react";
import Link from "next/link";
import { Review } from "@/components/form/Review";
import { ZustandFormBackendProvider } from "@/components/form/backends/ZustandBackend";
import { formSpec } from "@/lib/form-data";

export const metadata = { title: "Review · Demo" };

/**
 * Demo's review screen. Reads from Zustand (browser local), not the DB —
 * mirrors what a real respondent sees, but never persists. The DB-backed
 * runner has its own review at /survey/[id]/review.
 */
export default function DemoReviewPage() {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/demo" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="font-display text-base">e</span>
            </div>
            <div>
              <p className="font-display text-lg leading-tight text-ink">
                {formSpec.meta.title}
              </p>
              <p className="text-xs text-muted">{formSpec.meta.subtitle}</p>
            </div>
          </Link>
          <span className="rounded-control border border-accent/40 bg-accent-soft/40 px-3 py-1 text-xs text-accent-deep">
            Demo
          </span>
        </div>
      </header>
      <Suspense fallback={null}>
        <ZustandFormBackendProvider>
          <Review basePath="/demo" donePath="/done" />
        </ZustandFormBackendProvider>
      </Suspense>
    </div>
  );
}
