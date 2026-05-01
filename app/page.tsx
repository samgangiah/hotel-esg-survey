import { Suspense } from "react";
import { Wizard } from "@/components/form/Wizard";
import { formSpec } from "@/lib/form-data";

export default function HomePage() {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="font-display text-base">e</span>
            </div>
            <div>
              <p className="font-display text-lg leading-tight text-ink">
                {formSpec.meta.title}
              </p>
              <p className="text-xs text-muted">
                {formSpec.meta.subtitle} · ~{formSpec.meta.estimatedMinutes} min
              </p>
            </div>
          </div>
        </div>
      </header>
      <Suspense fallback={null}>
        <Wizard />
      </Suspense>
    </div>
  );
}
