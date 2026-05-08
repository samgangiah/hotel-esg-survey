"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SavedActions() {
  const params = useSearchParams();
  const section = params.get("section");
  const group = params.get("group");
  const back = section && group ? `/?section=${section}&group=${group}` : "/";
  return (
    <Link href={back}>
      <Button variant="secondary">Continue where I left off</Button>
    </Link>
  );
}
