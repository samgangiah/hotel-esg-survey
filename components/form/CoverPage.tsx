"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formSpec } from "@/lib/form-data";
import type { CoverTip } from "@/lib/schema";

/**
 * Cover page rendered as the first thing a respondent sees. Editable from the
 * form spec (`meta.coverPage`) so Penny can update copy without code.
 *
 * The basePath defaults to `/` (demo). The DB-backed survey at
 * /survey/[instanceId] passes its own basePath so "Begin the survey" stays
 * inside the per-respondent route.
 */
export function CoverPage({
  basePath = "/",
  spec,
}: {
  basePath?: string;
  spec?: typeof formSpec;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const activeSpec = spec ?? formSpec;
  const cover = activeSpec.meta.coverPage;
  if (!cover) return null;

  const showAdded = params.get("showAdded") === "true";

  const begin = () => {
    const firstSection = activeSpec.sections[0];
    const firstGroup = firstSection.groups[0];
    const qs = new URLSearchParams();
    qs.set("section", firstSection.id);
    qs.set("group", firstGroup.id);
    if (showAdded) qs.set("showAdded", "true");
    router.push(`${basePath}?${qs.toString()}`);
  };

  const intros = Array.isArray(cover.intro) ? cover.intro : [cover.intro];
  const footers = cover.footer
    ? Array.isArray(cover.footer)
      ? cover.footer
      : [cover.footer]
    : [];
  const pointersHeading = cover.pointersHeading ?? "A few pointers";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Card className="space-y-8 p-8 sm:p-12">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted">
            Hotel Energy &amp; ESG Survey
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">
            {cover.headline}
          </h1>
        </header>

        {intros.length > 0 && (
          <div className="space-y-4 text-ink/90">
            {intros.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {cover.tips && cover.tips.length > 0 && (
          <div className="space-y-4 rounded-card border border-line bg-canvas/40 p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {pointersHeading}
            </p>
            <ul className="space-y-3">
              {cover.tips.map((raw, i) => {
                const tip: CoverTip =
                  typeof raw === "string" ? { body: raw } : raw;
                return (
                  <li key={i} className="flex gap-3 text-sm text-ink/90">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    <div className="flex-1 space-y-1.5">
                      <span
                        dangerouslySetInnerHTML={{
                          __html: renderInline(tip.body),
                        }}
                      />
                      {tip.items && tip.items.length > 0 && (
                        <ul className="ml-1 mt-1.5 space-y-1.5 border-l border-line pl-4">
                          {tip.items.map((sub, j) => (
                            <li
                              key={j}
                              className="text-sm text-ink/80"
                              dangerouslySetInnerHTML={{
                                __html: renderInline(sub),
                              }}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="pt-1">
          <Button size="lg" onClick={begin}>
            {cover.ctaLabel ?? "Begin the survey"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {footers.length > 0 && (
          <div className="space-y-3 border-t border-line pt-6 text-sm text-muted">
            {footers.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
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
