"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Wizard } from "../Wizard";
import { CoverPage } from "../CoverPage";
import { DbFormBackendProvider } from "../backends/DbBackend";
import type { Answers, FormSpec } from "@/lib/schema";

/**
 * Client wrapper that gives the existing Wizard a DB-backed FormBackend.
 * Server component (`/survey/[instanceId]/page.tsx`) loads the data and hands
 * it down as initial props.
 */
export function DbSurveyShell({
  instanceId,
  spec,
  initialAnswers,
  initialSubmittedSections,
  respondentName,
  siteName,
  operatorName,
  showCoverByDefault,
}: {
  instanceId: string;
  spec: FormSpec;
  initialAnswers: Answers;
  initialSubmittedSections: Record<string, boolean>;
  respondentName: string;
  siteName: string;
  operatorName: string;
  showCoverByDefault: boolean;
}) {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="font-display text-base">e</span>
            </div>
            <div>
              <p className="font-display text-base leading-tight text-ink">
                {siteName}
              </p>
              <p className="text-xs text-muted">
                {operatorName} · signed in as {respondentName}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted">
            Your answers are saved automatically. Use{" "}
            <Link
              href="/saved"
              className="underline-offset-2 hover:text-ink hover:underline"
            >
              Save for later
            </Link>{" "}
            on any page to step away.
          </p>
        </div>
      </header>

      <DbFormBackendProvider
        instanceId={instanceId}
        initialAnswers={initialAnswers}
        initialSubmittedSections={initialSubmittedSections}
      >
        <Suspense fallback={null}>
          {showCoverByDefault ? (
            <CoverPage />
          ) : (
            <Wizard
              formSpec={spec}
              basePath={`/survey/${instanceId}`}
              savedPath="/saved"
              reviewPath={`/survey/${instanceId}/review`}
            />
          )}
        </Suspense>
      </DbFormBackendProvider>
    </div>
  );
}
