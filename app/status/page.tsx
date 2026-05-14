import { Card } from "@/components/ui/Card";

export const metadata = { title: "Status" };

// Manually flipped during incidents. See runbooks/INCIDENT.md.
type SystemStatus = "normal" | "investigating" | "degraded" | "down";
const SYSTEM_STATUS: SystemStatus = "normal";

const COPY: Record<SystemStatus, { headline: string; detail: string }> = {
  normal: {
    headline: "All systems normal",
    detail: "The survey is operating as expected.",
  },
  investigating: {
    headline: "Investigating an issue",
    detail:
      "We're aware of a problem and looking into it. Your data is safe; please try again in a few minutes.",
  },
  degraded: {
    headline: "Partial degradation",
    detail:
      "Some operations may be slower than usual. The survey is still accepting answers.",
  },
  down: {
    headline: "Service unavailable",
    detail:
      "We're working to restore the service. Your in-progress answers are saved.",
  },
};

const dotClass: Record<SystemStatus, string> = {
  normal: "bg-emerald-500",
  investigating: "bg-amber-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};

export default function StatusPage() {
  const copy = COPY[SYSTEM_STATUS];
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card className="space-y-4 p-8 sm:p-10">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass[SYSTEM_STATUS]}`}
            aria-hidden
          />
          <p className="text-xs uppercase tracking-wide text-muted">
            PHS Energy — status
          </p>
        </div>
        <h1 className="font-display text-3xl text-ink">{copy.headline}</h1>
        <p className="text-muted">{copy.detail}</p>
        <p className="text-xs text-muted">
          Last updated:{" "}
          {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
        </p>
      </Card>
    </div>
  );
}
