"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormStore } from "@/lib/store";
import type { Section, Group } from "@/lib/schema";

export function SectionNav({
  section,
  currentGroupId,
}: {
  section: Section;
  currentGroupId: string;
}) {
  const answers = useFormStore((s) => s.answers);
  const params = useSearchParams();
  const showAdded = params.get("showAdded") === "true";

  return (
    <nav className="space-y-1">
      <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted">
        {section.title}
      </div>
      <ul className="space-y-0.5">
        {section.groups.map((g) => {
          const hasAny = groupHasAnswer(g, answers);
          const isCurrent = g.id === currentGroupId;
          return (
            <li key={g.id}>
              <Link
                href={`/?section=${section.id}&group=${g.id}${showAdded ? "&showAdded=true" : ""}`}
                className={cn(
                  "flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors",
                  isCurrent
                    ? "bg-accent-soft/70 font-medium text-accent-deep"
                    : "text-ink/80 hover:bg-accent-soft/40"
                )}
              >
                {hasAny ? (
                  <CircleDot className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-line" />
                )}
                <span className="truncate">
                  {g.title ?? "Property details"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function groupHasAnswer(g: Group, answers: Record<string, unknown>) {
  for (const q of g.questions) {
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return true;
  }
  return false;
}
