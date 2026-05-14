"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Wizard } from "../Wizard";
import { CoverPage } from "../CoverPage";
import { DbFormBackendProvider } from "../backends/DbBackend";
import type { DelegationView } from "../state-context";
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
  initialDelegations,
  respondentName,
  siteName,
  operatorName,
  showCoverByDefault,
  isClosed,
  closedAt,
}: {
  instanceId: string;
  spec: FormSpec;
  initialAnswers: Answers;
  initialSubmittedSections: Record<string, boolean>;
  initialDelegations: Record<string, DelegationView>;
  respondentName: string;
  siteName: string;
  operatorName: string;
  showCoverByDefault: boolean;
  isClosed: boolean;
  closedAt: Date | null;
}) {
  return (
    <div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-card bg-accent text-white">
              <span className="text-xs font-medium">phs</span>
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

      {isClosed && (
        <div className="border-b border-accent/30 bg-accent-soft/50">
          <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm text-accent-deep sm:px-6">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">This survey is closed.</span>{" "}
              {closedAt && (
                <>
                  Submitted on{" "}
                  <span className="font-medium">
                    {closedAt.toISOString().slice(0, 10)}
                  </span>
                  .{" "}
                </>
              )}
              You can still review your answers — but no new edits are accepted
              until your Operator Admin reopens it.
            </p>
          </div>
        </div>
      )}

      <DbFormBackendProvider
        instanceId={instanceId}
        initialAnswers={initialAnswers}
        initialSubmittedSections={initialSubmittedSections}
        initialDelegations={initialDelegations}
      >
        <Suspense fallback={null}>
          {showCoverByDefault ? (
            <CoverPage basePath={`/survey/${instanceId}`} spec={spec} />
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
