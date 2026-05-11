"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Circle, CircleCheck, CircleDot, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { formSpec as defaultFormSpec } from "@/lib/form-data";
import type { FormSpec, Group, Section } from "@/lib/schema";
import { useFormBackend } from "./state-context";

export function SectionNav({
  currentSectionId,
  currentGroupId,
  spec = defaultFormSpec,
  basePath = "/",
}: {
  currentSectionId: string;
  currentGroupId: string;
  spec?: FormSpec;
  basePath?: string;
}) {
  const { answers, submittedSections } = useFormBackend();
  const params = useSearchParams();
  const showAdded = params.get("showAdded") === "true";

  return (
    <nav className="rounded-card border border-line bg-white p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
        <ListOrdered className="h-4 w-4 text-accent-deep" />
        <span className="font-display text-base font-semibold text-ink">
          Contents
        </span>
      </div>

      <div className="space-y-4">
        {spec.sections.map((s, i) => {
          const isCurrent = s.id === currentSectionId;
          const isSubmitted = !!submittedSections[s.id];
          const sectionHref = buildHref(s, s.groups[0], basePath, showAdded);
          return (
            <div key={s.id} className="space-y-1.5">
              <Link
                href={sectionHref}
                className={cn(
                  "flex items-center gap-2 rounded-control px-2 py-1 text-[13px] font-semibold uppercase tracking-wide transition-colors",
                  isCurrent
                    ? "text-accent-deep"
                    : "text-ink/80 hover:text-accent-deep"
                )}
              >
                {isSubmitted ? (
                  <CircleCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                ) : (
                  <span
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 rounded-full border",
                      isCurrent ? "border-accent" : "border-line"
                    )}
                  />
                )}
                <span>
                  Section {i + 1}: {s.title}
                </span>
              </Link>

              <ul className="ml-2 space-y-0.5 border-l border-line pl-3">
                {s.groups.map((g) => {
                  const hasAny = groupHasAnswer(g, answers);
                  const isCurrentGroup =
                    g.id === currentGroupId && s.id === currentSectionId;
                  const href = buildHref(s, g, basePath, showAdded);
                  return (
                    <li key={g.id}>
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center gap-2 rounded-control px-2 py-1.5 text-sm transition-colors",
                          isCurrentGroup
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
          );
        })}
      </div>
    </nav>
  );
}

function buildHref(s: Section, g: Group, basePath: string, showAdded: boolean): string {
  const qs = new URLSearchParams();
  qs.set("section", s.id);
  qs.set("group", g.id);
  if (showAdded) qs.set("showAdded", "true");
  return `${basePath}?${qs.toString()}`;
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
