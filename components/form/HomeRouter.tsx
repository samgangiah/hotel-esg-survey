"use client";

import { useSearchParams } from "next/navigation";
import { CoverPage } from "./CoverPage";
import { Wizard } from "./Wizard";

/**
 * The form's landing decides between cover page and wizard:
 * - no `?section=...` → cover page
 * - any `?section=...` → wizard at that location
 */
export function HomeRouter() {
  const params = useSearchParams();
  const hasSection = !!params.get("section");
  return hasSection ? <Wizard /> : <CoverPage />;
}
