"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * "Continue where I left off" button on /saved. Reads `?back=<basePath>`
 * (set by the Wizard's Save-for-later) and rebuilds the wizard URL there.
 * Falls back to `/` so anyone who lands here without context lands on the
 * marketing page rather than a broken state.
 */
export function SavedActions() {
  const params = useSearchParams();
  const section = params.get("section");
  const group = params.get("group");
  const rawBack = params.get("back") ?? "/";
  // Be defensive: only allow same-origin relative paths.
  const back = rawBack.startsWith("/") ? rawBack : "/";
  const target =
    section && group
      ? `${back}?section=${section}&group=${group}`
      : back;
  return (
    <Link href={target}>
      <Button variant="secondary">Continue where I left off</Button>
    </Link>
  );
}
