import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Send,
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  FileJson,
  FolderOpen,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { AdminNav } from "@/components/admin/AdminNav";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { CloseSurveyButton } from "@/components/operator/CloseSurveyButton";
import { RespondentControls } from "@/components/admin/RespondentControls";
import { resendInvitation, adminCloseInstance, adminReopenInstance } from "./actions";
import {
  softDeleteRespondent,
  undeleteRespondent,
} from "@/app/admin/respondents/[id]/actions";

export const metadata = { title: "Operator" };
export const dynamic = "force-dynamic";

export default async function OperatorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const operator = await db.operator.findFirst({
    where: { id, deletedAt: null },
    include: {
      sites: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          buildings: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
          surveyInstances: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      // Include soft-deleted respondents so the admin can see + restore them.
      respondents: {
        orderBy: [{ isOperatorAdmin: "desc" }, { createdAt: "asc" }],
        include: {
          assignments: {
            include: {
              invitations: { orderBy: { sentAt: "desc" }, take: 1 },
              surveyInstance: { include: { site: true } },
              building: true,
            },
          },
          sessions: {
            orderBy: { lastSeenAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!operator) notFound();

  const totalAssignments = operator.respondents.reduce(
    (a, r) => a + r.assignments.length,
    0
  );

  return (
    <>
      <AdminNav active="/admin" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to operators
          </Link>
        </div>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Operator
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink">
              {operator.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {operator.sites.length} site{operator.sites.length === 1 ? "" : "s"}{" "}
              · {operator.respondents.length} respondent
              {operator.respondents.length === 1 ? "" : "s"} · {totalAssignments}{" "}
              assignment{totalAssignments === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/operators/${operator.id}/files`}
              title="Inventory of every uploaded file for this operator"
            >
              <Button variant="secondary" size="sm">
                <FolderOpen className="h-3.5 w-3.5" />
                Files
              </Button>
            </Link>
            <a
              href={`/admin/operators/${operator.id}/export.csv`}
              download
              title="Long-format CSV of every answer"
            >
              <Button variant="secondary" size="sm">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <Download className="h-3 w-3" />
                Answers (CSV)
              </Button>
            </a>
            <a
              href={`/admin/operators/${operator.id}/export.json`}
              download
              title="Full operator dump: sites, buildings, respondents, instances, answers, submissions, email events, audit log"
            >
              <Button variant="secondary" size="sm">
                <FileJson className="h-3.5 w-3.5" />
                <Download className="h-3 w-3" />
                Full dump (JSON)
              </Button>
            </a>
          </div>
        </header>

        {sp.msg && (
          <Card className="mb-6 border-accent/40 bg-accent-soft/40 px-4 py-3 text-sm text-accent-deep">
            <CircleCheck className="mr-2 inline-block h-4 w-4 align-text-bottom" />
            {sp.msg}
          </Card>
        )}

        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg text-ink">Sites</h2>
          <Card className="divide-y divide-line">
            {operator.sites.map((s) => {
              const inst = s.surveyInstances[0];
              return (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink">{s.name}</p>
                      {s.address && (
                        <p className="text-xs text-muted">{s.address}</p>
                      )}
                      <p className="mt-1 text-xs text-muted">
                        {s.buildings.length} building
                        {s.buildings.length === 1 ? "" : "s"}
                        {inst ? (
                          <>
                            {" · status: "}
                            <span className="font-medium text-ink">
                              {inst.status}
                            </span>
                            {inst.lockedAt && (
                              <span>
                                {" · closed "}
                                {inst.lockedAt.toISOString().slice(0, 10)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span> · no instance</span>
                        )}
                      </p>
                    </div>
                    {inst && (
                      <CloseSurveyButton
                        instanceId={inst.id}
                        status={inst.status}
                        onClose={adminCloseInstance}
                        onReopen={adminReopenInstance}
                      />
                    )}
                  </div>
                  {s.buildings.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      {s.buildings.map((b) => b.name).join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg text-ink">Respondents</h2>
          {operator.respondents.length === 0 ? (
            <Card className="px-6 py-8 text-center text-sm text-muted">
              No respondents yet.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {operator.respondents.map((r) => {
                const lastSession = r.sessions[0];
                const isDeleted = r.deletedAt !== null;
                return (
                  <div
                    key={r.id}
                    className={
                      "px-6 py-4" + (isDeleted ? " opacity-60" : "")
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="font-medium text-ink">{r.name}</p>
                          {r.isOperatorAdmin && (
                            <Pill>
                              <ShieldCheck className="h-3 w-3" /> Operator Admin
                            </Pill>
                          )}
                          {r.emailInvalid && (
                            <Pill className="border-danger/40 bg-danger/10 text-danger">
                              <CircleAlert className="h-3 w-3" /> email invalid
                            </Pill>
                          )}
                        </div>
                        <p className="text-xs text-muted">
                          {r.email}
                          {lastSession && (
                            <>
                              {" · last seen "}
                              {timeAgo(lastSession.lastSeenAt)}
                            </>
                          )}
                        </p>
                      </div>
                      <RespondentControls
                        respondentId={r.id}
                        isDeleted={isDeleted}
                        onDelete={softDeleteRespondent}
                        onUndelete={undeleteRespondent}
                      />
                    </div>

                    {r.assignments.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {r.assignments.map((a) => {
                          const inv = a.invitations[0];
                          return (
                            <li
                              key={a.id}
                              className="flex flex-wrap items-baseline justify-between gap-3 rounded-control border border-line bg-canvas/40 px-3 py-2 text-xs"
                            >
                              <span>
                                <span className="font-medium text-ink">
                                  {a.surveyInstance.site.name}
                                </span>{" "}
                                · section{" "}
                                <span className="font-mono">{a.sectionId}</span> ·
                                role <span className="font-mono">{a.role}</span>
                                {a.building ? ` · ${a.building.name}` : ""} ·{" "}
                                <span className="text-muted">{a.status}</span>
                              </span>
                              <span className="flex items-center gap-2 text-muted">
                                {inv ? (
                                  <span>
                                    invite{" "}
                                    {inv.openedAt
                                      ? "opened"
                                      : inv.expiresAt < new Date()
                                        ? "expired"
                                        : "sent"}{" "}
                                    {timeAgo(inv.sentAt)}
                                  </span>
                                ) : (
                                  <span>no invite</span>
                                )}
                                <ResendForm assignmentId={a.id} operatorId={operator.id} />
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

function ResendForm({
  assignmentId,
  operatorId,
}: {
  assignmentId: string;
  operatorId: string;
}) {
  async function action() {
    "use server";
    const result = await resendInvitation(assignmentId);
    if (!result.ok) {
      redirect(
        `/admin/operators/${operatorId}?msg=${encodeURIComponent(`Resend failed: ${result.error}`)}`
      );
    }
    redirect(
      `/admin/operators/${operatorId}?msg=${encodeURIComponent("New invitation sent — old link invalidated.")}`
    );
  }
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant="ghost" className="!h-7 !px-2">
        <Send className="h-3 w-3" /> Resend
      </Button>
    </form>
  );
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toISOString().slice(0, 10);
}
