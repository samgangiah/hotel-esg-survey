"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ROLE_KEYS, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/roles";

/**
 * Per-team-member edit + remove controls for /operator/team.
 *
 * - "Edit" expands an inline editor: role checkboxes + building checkboxes.
 * - "Remove" shows an inline confirm before soft-deleting the member.
 *
 * Both call server actions and refresh the route on success.
 */
export function EditTeamMember({
  respondentId,
  respondentName,
  currentRoles,
  currentBuildingIds,
  allBuildings,
  onUpdate,
  onRemove,
}: {
  respondentId: string;
  respondentName: string;
  currentRoles: string[];
  /** Empty array means "all buildings". */
  currentBuildingIds: string[];
  allBuildings: Array<{ id: string; label: string }>;
  onUpdate: (args: {
    respondentId: string;
    roles: string[];
    buildingIds: string[];
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemove: (
    respondentId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "editing" | "confirmRemove">(
    "idle"
  );
  const [roles, setRoles] = useState<string[]>(currentRoles);
  const [buildingIds, setBuildingIds] = useState<string[]>(currentBuildingIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(list: string[], value: string): string[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function save() {
    setError(null);
    if (roles.length === 0) {
      setError("Pick at least one role.");
      return;
    }
    startTransition(async () => {
      const result = await onUpdate({ respondentId, roles, buildingIds });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMode("idle");
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await onRemove(respondentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (mode === "idle") {
    return (
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setRoles(currentRoles);
            setBuildingIds(currentBuildingIds);
            setError(null);
            setMode("editing");
          }}
          className="inline-flex items-center gap-1 rounded p-1 text-xs text-muted hover:bg-canvas hover:text-accent-deep"
        >
          <Pencil className="h-3 w-3" /> Edit roles
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode("confirmRemove");
          }}
          className="inline-flex items-center gap-1 rounded p-1 text-xs text-muted hover:bg-canvas hover:text-danger"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>
    );
  }

  if (mode === "confirmRemove") {
    return (
      <div className="mt-2 flex flex-col items-start gap-1.5">
        <p className="text-xs text-ink">
          Remove <span className="font-medium">{respondentName}</span> from the
          survey? Their answers are kept; they can no longer sign in.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMode("idle")}
            disabled={pending}
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-control bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90 disabled:opacity-50"
          >
            {pending ? "Removing…" : "Yes, remove"}
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  // editing
  return (
    <div className="mt-3 space-y-3 rounded-control border border-accent/40 bg-accent-soft/30 p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-accent-deep">
          Edit {respondentName}
        </p>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="rounded p-0.5 text-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-ink">Roles</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {ROLE_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-2 rounded-control border border-line bg-white px-3 py-2 text-xs hover:border-accent/40"
            >
              <input
                type="checkbox"
                checked={roles.includes(key)}
                onChange={() => setRoles((r) => toggle(r, key))}
                className="mt-0.5 h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
              />
              <span>
                <span className="font-medium text-ink">
                  {ROLE_LABELS[key]}
                </span>
                <span className="block text-[11px] text-muted">
                  {ROLE_DESCRIPTIONS[key]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {allBuildings.length > 1 && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium text-ink">
            Buildings{" "}
            <span className="font-normal text-muted">
              (none ticked = all buildings)
            </span>
          </legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {allBuildings.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-2 rounded-control border border-line bg-white px-3 py-2 text-xs hover:border-accent/40"
              >
                <input
                  type="checkbox"
                  checked={buildingIds.includes(b.id)}
                  onChange={() => setBuildingIds((v) => toggle(v, b.id))}
                  className="h-3.5 w-3.5 rounded border-line text-accent focus:ring-accent"
                />
                <span className="text-ink">{b.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMode("idle")}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
