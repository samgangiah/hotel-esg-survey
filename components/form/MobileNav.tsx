"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { FormSpec, Section } from "@/lib/schema";
import { SectionNav } from "./SectionNav";

export function MobileNav({
  section,
  currentSectionId,
  currentGroupId,
  spec,
  basePath,
}: {
  section: Section;
  currentSectionId: string;
  currentGroupId: string;
  spec?: FormSpec;
  basePath?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm"
      >
        <Menu className="h-4 w-4 text-muted" />
        <span className="text-muted">Section:</span>
        <span className="font-medium text-ink">{section.title}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-ink/30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="w-72 overflow-y-auto bg-white p-4 shadow-card"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              className="mb-4 flex items-center gap-2 text-sm text-muted"
            >
              <X className="h-4 w-4" />
              Close
            </button>
            <SectionNav
              currentSectionId={currentSectionId}
              currentGroupId={currentGroupId}
              spec={spec}
              basePath={basePath}
            />
          </div>
        </div>
      )}
    </div>
  );
}
