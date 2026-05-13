"use client";

import { useSearchParams } from "next/navigation";
import { CoverPage } from "./CoverPage";
import { Wizard } from "./Wizard";
import { ZustandFormBackendProvider } from "./backends/ZustandBackend";

/**
 * Demo runner at /demo. Browser-only state — nothing reaches the server.
 *
 *  - No `?section=` → CoverPage at basePath=/demo
 *  - With `?section=` → Wizard inside the Zustand backend
 *
 * The Wizard's "Save for later" + "Review" + "Submit" targets are all
 * scoped under /demo so the demo flow doesn't collide with anything else.
 */
export function DemoRouter() {
  const params = useSearchParams();
  const hasSection = !!params.get("section");
  return (
    <ZustandFormBackendProvider>
      {hasSection ? (
        <Wizard basePath="/demo" reviewPath="/demo/review" />
      ) : (
        <CoverPage basePath="/demo" />
      )}
    </ZustandFormBackendProvider>
  );
}
