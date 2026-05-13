"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * Renders the small "Back to the cover page" link beneath /saved. Honours
 * `?back=` so a real respondent returns to their survey's cover, not the
 * marketing page.
 */
export function SavedBackLink() {
  const params = useSearchParams();
  const rawBack = params.get("back") ?? "/";
  const back = rawBack.startsWith("/") ? rawBack : "/";
  return (
    <Link
      href={back}
      className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
    >
      Back to the cover page
    </Link>
  );
}
