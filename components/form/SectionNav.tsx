"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormStore } from "@/lib/store";
import { formSpec } from "@/lib/form-data";
import type { Group, Section } from "@/lib/schema";

/**
 * v0.3 nav: every section + every group is visible and clickable. Respondents
 * can jump between any pair of groups in any order, regardless of which
 * section they're in.
 */
export function SectionNav({
  currentSectionId,
  currentGroupId,
}: {
  currentSectionId: string;
  currentGroupId: string;
}) {
  const answers = useFormStore((s) => s.answers);
  const params = useSearchParams();
  const showAdded = params.get("showAdded") === "true";

  return (
    <nav className="space-y-4">
      {formSpec.sections.map((s) => (
        <div key={s.id} className="space-y-1">
          <div
            className={cn(
              "px-3 text-xs font-medium uppercase tracking-wide",
              s.id === currentSectionId ? "text-accent-deep" : "text-muted"
            )}
          >
            {s.title}
          </div>
          <ul className="space-y-0.5">
            {s.groups.map((g) => {
              const hasAny = groupHasAnswer(g, answers);
              const isCurrent =
                g.id === currentGroupId && s.id === currentSectionId;
              const href = buildHref(s, g, showAdded);
              return (
                <li key={g.id}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-control px-3 py-1.5 text-sm transition-colors",
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
        </div>
      ))}
    </nav>
  );
}

function buildHref(s: Section, g: Group, showAdded: boolean): string {
  const qs = new URLSearchParams();
  qs.set("section", s.id);
  qs.set("group", g.id);
  if (showAdded) qs.set("showAdded", "true");
  return `/?${qs.toString()}`;
}

function groupHasAnswer(g: Group, answers: Record<string, unknown>) {
  for (const q of g.questions) {
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && Object.keys(v as object).length === 0) continue;
    return true;
  }
  return false;
}
