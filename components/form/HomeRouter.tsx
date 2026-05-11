"use client";

import { useSearchParams } from "next/navigation";
import { CoverPage } from "./CoverPage";
import { Wizard } from "./Wizard";
import { ZustandFormBackendProvider } from "./backends/ZustandBackend";

/**
 * The form's landing decides between cover page and wizard:
 * - no `?section=...` → cover page
 * - any `?section=...` → wizard at that location (Zustand-backed for the demo)
 */
export function HomeRouter() {
  const params = useSearchParams();
  const hasSection = !!params.get("section");
  return (
    <ZustandFormBackendProvider>
      {hasSection ? <Wizard /> : <CoverPage />}
    </ZustandFormBackendProvider>
  );
}
