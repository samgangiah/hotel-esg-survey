"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formSpec } from "@/lib/form-data";

/**
 * Cover page rendered as the first thing a respondent sees. Editable from
 * the form spec (`meta.coverPage`) so Penny can update copy without code.
 */
export function CoverPage() {
  const router = useRouter();
  const params = useSearchParams();
  const cover = formSpec.meta.coverPage;
  if (!cover) return null;

  const showAdded = params.get("showAdded") === "true";

  const begin = () => {
    const firstSection = formSpec.sections[0];
    const firstGroup = firstSection.groups[0];
    const qs = new URLSearchParams();
    qs.set("section", firstSection.id);
    qs.set("group", firstGroup.id);
    if (showAdded) qs.set("showAdded", "true");
    router.push(`/?${qs.toString()}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Card className="space-y-7 p-8 sm:p-12">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted">
            Hotel Energy &amp; ESG Survey
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
            {cover.headline}
          </h1>
        </header>

        <p className="text-ink/90">{cover.intro}</p>

        {cover.tips && cover.tips.length > 0 && (
          <div className="space-y-3 rounded-card border border-line bg-canvas/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              A few pointers
            </p>
            <ul className="space-y-2.5">
              {cover.tips.map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink/90">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span dangerouslySetInnerHTML={{ __html: renderInline(tip) }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-1">
          <Button size="lg" onClick={begin}>
            {cover.ctaLabel ?? "Begin the survey"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Tiny inline-bold renderer — supports **text** only. Escapes HTML otherwise. */
function renderInline(input: string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
