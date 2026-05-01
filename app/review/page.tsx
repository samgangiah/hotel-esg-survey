import { Suspense } from "react";
import Link from "next/link";
import { Review } from "@/components/form/Review";
import { formSpec } from "@/lib/form-data";

export default function ReviewPage() {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
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
        </div>
      </header>
      <Suspense fallback={null}>
        <Review />
      </Suspense>
    </div>
  );
}
