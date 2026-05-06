import Link from "next/link";
import { Circle, CircleCheck, CirclePlay, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { OperatorNav } from "@/components/operator/OperatorNav";
import { db } from "@/lib/db";
import { requireOperatorAdmin } from "@/lib/operator-admin-auth";
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const metadata = { title: "Progress" };
export const dynamic = "force-dynamic";

type CellStatus = "unassigned" | "pending" | "opened" | "submitted" | "abandoned";

export default async function ProgressPage() {
  const me = await requireOperatorAdmin();

  const operator = await db.operator.findUnique({
    where: { id: me.operatorId },
    include: {
      sites: {
        where: { deletedAt: null },
        include: {
          buildings: {
            where: { deletedAt: null },
            include: {
              assignments: {
                include: {
                  respondent: true,
                  invitations: { orderBy: { sentAt: "desc" }, take: 1 },
                },
              },
            },
          },
        },
      },
      // Fetch every Respondent with their assignments so we can also surface
      // assignments where buildingId is NULL (Operator-Admin "all" sentinels).
      respondents: {
        where: { deletedAt: null, isOperatorAdmin: true },
        include: {
          assignments: {
            where: { buildingId: null },
            include: {
              invitations: { orderBy: { sentAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!operator) return null;

  const buildings = operator.sites.flatMap((s) =>
    s.buildings.map((b) => ({ siteName: s.name, ...b }))
  );

  // Operator-Admin sentinel assignments (one row per admin, sectionId="all",
  // buildingId=null) — these grant access across every building × every role.
  const adminSentinels = operator.respondents.flatMap((r) =>
    r.assignments
      .filter((a) => a.sectionId === "all")
      .map((a) => ({ ...a, respondent: r }))
  );

  return (
    <>
      <OperatorNav active="/operator/progress" operatorName={me.operatorName} />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-wide text-muted">Progress</p>
          <h1 className="mt-1 font-display text-3xl text-ink">
            Who's done what
          </h1>
          <p className="mt-1 text-sm text-muted">
            One row per building, one column per role. Each cell shows the
            status of every respondent assigned to that building × role.
          </p>
        </header>

        {buildings.length === 0 ? (
          <Card className="p-6 text-sm text-muted">No buildings yet.</Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/40">
                  <th className="sticky left-0 z-10 bg-canvas/40 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                    Building
                  </th>
                  {ROLE_KEYS.map((role) => (
                    <th
                      key={role}
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildings.map((b) => (
                  <tr key={b.id} className="border-b border-line/60">
                    <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left align-top">
                      <span className="block font-medium text-ink">
                        {b.name}
                      </span>
                      <span className="block text-xs text-muted">
                        {b.siteName}
                      </span>
                    </th>
                    {ROLE_KEYS.map((role) => {
                      // Per-building, per-role assignments (Anna's
                      // housekeeping at Main building, etc).
                      const cell = b.assignments.filter((a) => a.role === role);
                      // Operator-Admin sentinels apply across every building ×
                      // every role — show them in every cell.
                      const merged = [...cell, ...adminSentinels];
                      return (
                        <td key={role} className="px-3 py-3 align-top">
                          {merged.length === 0 ? (
                            <CellEmpty />
                          ) : (
                            <div className="space-y-1.5">
                              {merged.map((a) => {
                                const inv = a.invitations[0];
                                const status: CellStatus = a.respondent
                                  .isOperatorAdmin
                                  ? a.status === "submitted"
                                    ? "submitted"
                                    : "opened"
                                  : (a.status as CellStatus);
                                return (
                                  <CellChip
                                    key={a.id}
                                    name={a.respondent.name}
                                    isAdmin={a.respondent.isOperatorAdmin}
                                    status={status}
                                    note={
                                      inv && !inv.openedAt
                                        ? `invite sent ${shortAgo(inv.sentAt)}`
                                        : undefined
                                    }
                                  />
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <p className="mt-6 text-xs text-muted">
          Need to invite someone?{" "}
          <Link
            href="/operator/team"
            className="underline-offset-2 hover:text-ink hover:underline"
          >
            Open team management →
          </Link>
        </p>
      </div>
    </>
  );
}

function CellEmpty() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted/70">
      <Circle className="h-3 w-3" /> unassigned
    </span>
  );
}

function CellChip({
  name,
  isAdmin,
  status,
  note,
}: {
  name: string;
  isAdmin: boolean;
  status: CellStatus;
  note?: string;
}) {
  const colors: Record<CellStatus, string> = {
    unassigned: "border-line bg-white text-muted",
    pending: "border-line bg-white text-muted",
    opened: "border-amber-300/60 bg-amber-50/60 text-amber-700",
    submitted: "border-accent/40 bg-accent-soft text-accent-deep",
    abandoned: "border-danger/40 bg-danger/10 text-danger",
  };
  const Icon = {
    unassigned: Circle,
    pending: Circle,
    opened: CirclePlay,
    submitted: CircleCheck,
    abandoned: CircleAlert,
  }[status];

  return (
    <div
      className={cn(
        "rounded-control border px-2 py-1.5 text-xs",
        colors[status]
      )}
    >
      <span className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        <span className="font-medium">
          {name}
          {isAdmin && <span className="ml-1 text-[10px] opacity-70">(admin)</span>}
        </span>
      </span>
      {note && (
        <span className="mt-0.5 block text-[10px] text-muted">{note}</span>
      )}
    </div>
  );
}

function shortAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
