"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Building2,
  Users,
  Pencil,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EditOperatorName } from "./EditOperatorName";

/**
 * First-run setup wizard. Renders in place of the operator dashboard the
 * first time a customer signs in (`Operator.setupCompletedAt IS NULL`).
 *
 * Step 1 — rename the placeholder hotel + add address. Saving this is also
 *          the signal that completes setup (server-side), so the next render
 *          shows the regular dashboard.
 * Step 2 — confirm or rename the placeholder building, and add more if needed.
 * Step 3 — invite teammates (link out to /operator/team).
 * Step 4 — open the survey itself.
 *
 * Steps 2-4 don't block completion — the customer can come back to them
 * from the dashboard any time.
 */

interface BuildingRow {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface SetupWizardProps {
  operatorName: string;
  respondentName: string;
  site: {
    id: string;
    name: string;
    address: string | null;
    buildings: BuildingRow[];
  };
  surveyInstanceId: string;
  teamCount: number;
  onSaveSite: (
    siteId: string,
    args: { name: string; address: string | null }
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onAddBuilding: (
    siteId: string,
    name: string
  ) => Promise<{ ok: true; buildingId: string } | { ok: false; error: string }>;
  onRenameOperator: (
    name: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}

const PLACEHOLDER_SITE_NAME = "Your first hotel";
const PLACEHOLDER_BUILDING_NAME = "Main building";

export function SetupWizard({
  operatorName,
  respondentName,
  site,
  surveyInstanceId,
  teamCount,
  onSaveSite,
  onAddBuilding,
  onRenameOperator,
}: SetupWizardProps) {
  const router = useRouter();
  const [siteName, setSiteName] = useState(
    site.name === PLACEHOLDER_SITE_NAME ? "" : site.name
  );
  const [siteAddress, setSiteAddress] = useState(site.address ?? "");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [savingSite, startSavingSite] = useTransition();

  const siteIsNamed = site.name !== PLACEHOLDER_SITE_NAME;
  const buildingsRenamed = site.buildings.some(
    (b) => b.name !== PLACEHOLDER_BUILDING_NAME
  );
  const buildingsAreReady = site.buildings.length > 1 || buildingsRenamed;
  const teamIsInvited = teamCount > 1;

  function saveSite() {
    setSiteError(null);
    const trimmed = siteName.trim();
    if (!trimmed) {
      setSiteError("Give your hotel a name.");
      return;
    }
    startSavingSite(async () => {
      const result = await onSaveSite(site.id, {
        name: trimmed,
        address: siteAddress.trim() || null,
      });
      if (!result.ok) {
        setSiteError(result.error);
        return;
      }
      // Server-side, this rename also flips setupCompletedAt. Refresh so the
      // dashboard takes over.
      router.refresh();
    });
  }

  const firstName = respondentName.split(" ")[0] || respondentName;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted">
          Welcome
        </p>
        <h1 className="mt-1 font-display text-3xl text-ink">
          Let&apos;s get{" "}
          <EditOperatorName
            currentName={operatorName}
            onSave={onRenameOperator}
          />{" "}
          set up
        </h1>
        <p className="mt-2 text-muted">
          Hi {firstName} — just one quick step to get you started. The rest
          you can do at your own pace. Wrong company name above? Click the
          pencil to fix it.
        </p>
      </header>

      {/* Step 1 — name the hotel. Completing this auto-completes setup. */}
      <Step
        index={1}
        title="Tell us about your hotel"
        done={siteIsNamed}
        active={!siteIsNamed}
      >
        {siteIsNamed ? (
          <p className="text-sm text-muted">
            {site.name}
            {site.address ? ` · ${site.address}` : ""}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              The name and address of the hotel you'd like to survey. You can
              add more sites later from your dashboard.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="siteName"
                className="text-sm font-medium text-ink"
              >
                Hotel name
              </label>
              <Input
                id="siteName"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. DoubleTree Cardiff"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="siteAddress"
                className="text-sm font-medium text-ink"
              >
                Address{" "}
                <span className="text-xs font-normal text-muted">
                  (optional)
                </span>
              </label>
              <Input
                id="siteAddress"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                placeholder="Street, town, postcode"
              />
            </div>
            {siteError && <p className="text-sm text-danger">{siteError}</p>}
            <div className="flex justify-end pt-1">
              <Button onClick={saveSite} disabled={savingSite}>
                {savingSite ? "Saving…" : "Save and continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Step>

      {/* Steps 2-4 unlock after step 1. They don't block — they're guidance. */}
      <Step
        index={2}
        title="List your buildings"
        done={buildingsAreReady}
        active={siteIsNamed && !buildingsAreReady}
        muted={!siteIsNamed}
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Most hotels have one main building. If you have an annexe, spa,
            or separate laundry, add them as buildings so answers can be
            scoped properly.
          </p>
          {siteIsNamed && (
            <BuildingsEditor
              siteId={site.id}
              buildings={site.buildings}
              onAddBuilding={onAddBuilding}
            />
          )}
        </div>
      </Step>

      <Step
        index={3}
        title="Invite your team"
        done={teamIsInvited}
        active={siteIsNamed && !teamIsInvited}
        muted={!siteIsNamed}
      >
        <p className="text-sm text-muted">
          The survey is best filled by the people closest to each topic —
          your General Manager, engineering / maintenance lead, housekeeping,
          laundry, finance, and energy / ESG manager if you have one.
        </p>
        {siteIsNamed && (
          <p className="mt-3">
            <Link href="/operator/team">
              <Button size="sm" variant="secondary">
                <Users className="h-3.5 w-3.5" />
                Open team management
              </Button>
            </Link>
          </p>
        )}
      </Step>

      <Step
        index={4}
        title="Open the survey"
        done={false}
        active={siteIsNamed}
        muted={!siteIsNamed}
        isLast
      >
        <p className="text-sm text-muted">
          You can fill any section yourself or let your team handle theirs.
          Progress is saved automatically — you can come back through the
          same magic link any time.
        </p>
        {siteIsNamed && (
          <p className="mt-3">
            <Link href={`/survey/${surveyInstanceId}`}>
              <Button size="sm">
                <Pencil className="h-3.5 w-3.5" />
                Open the survey
              </Button>
            </Link>
          </p>
        )}
      </Step>
    </div>
  );
}

function Step({
  index,
  title,
  done,
  active,
  muted,
  isLast,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  active: boolean;
  muted?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={"relative flex gap-4 " + (isLast ? "" : "pb-6")}>
      <div className="flex flex-col items-center">
        <div
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border " +
            (done
              ? "border-accent bg-accent text-white"
              : active
                ? "border-accent bg-white text-accent-deep"
                : "border-line bg-white text-muted")
          }
        >
          {done ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <span className="text-sm font-medium">{index}</span>
          )}
        </div>
        {!isLast && (
          <div className="mt-1 flex-1 w-px bg-line" aria-hidden />
        )}
      </div>
      <div className={"flex-1 pb-2 " + (muted ? "opacity-60" : "")}>
        <Card
          className={
            "px-5 py-4 " + (active ? "border-accent/40 shadow-card" : "")
          }
        >
          <h3 className="font-display text-base text-ink">{title}</h3>
          <div className="mt-2">{children}</div>
        </Card>
      </div>
    </div>
  );
}

function BuildingsEditor({
  siteId,
  buildings,
  onAddBuilding,
}: {
  siteId: string;
  buildings: BuildingRow[];
  onAddBuilding: SetupWizardProps["onAddBuilding"];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  function add() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Building name?");
      return;
    }
    startAdding(async () => {
      const result = await onAddBuilding(siteId, trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {buildings.map((b) => (
          <li
            key={b.id}
            className="flex items-baseline justify-between gap-2 rounded-control border border-line bg-canvas/40 px-3 py-2 text-sm"
          >
            <span className="flex items-baseline gap-2">
              <Building2 className="h-3.5 w-3.5 self-center text-muted" />
              <span className={b.name === PLACEHOLDER_BUILDING_NAME ? "text-muted italic" : ""}>
                {b.name}
              </span>
              {b.isPrimary && (
                <span className="text-xs text-muted">primary</span>
              )}
            </span>
            <Link
              href={`/operator/sites/${siteId}`}
              className="text-xs text-muted hover:text-ink"
              title="Rename or remove"
            >
              edit
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] space-y-1">
          <label htmlFor="building" className="text-xs text-muted">
            Add another building
          </label>
          <Input
            id="building"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Annexe, Spa, Laundry"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={add}
          disabled={adding}
        >
          <Plus className="h-3.5 w-3.5" />
          {adding ? "Adding…" : "Add"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

