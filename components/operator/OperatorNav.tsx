import Link from "next/link";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, BarChart3, FileText, Pencil } from "lucide-react";

const NAV = [
  { href: "/operator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/operator/team", label: "Team", icon: Users },
  { href: "/operator/progress", label: "Progress", icon: BarChart3 },
  { href: "/operator/reports", label: "Reports", icon: FileText },
  { href: "/survey", label: "Open the survey", icon: Pencil },
];

export function OperatorNav({
  active,
  operatorName,
}: {
  active: string;
  operatorName: string;
}) {
  return (
    <nav className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 sm:px-6">
        <div className="-ml-1 mr-4 flex items-center gap-2 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-card bg-accent text-white text-[10px] font-medium">
            phs
          </span>
          <span className="hidden text-sm sm:inline">
            <span className="text-muted">Operator: </span>
            <span className="font-medium text-ink">{operatorName}</span>
          </span>
        </div>
        {NAV.map((item) => {
          const isActive = active === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent-soft/70 font-medium text-accent-deep"
                  : "text-muted hover:bg-accent-soft/40 hover:text-ink"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
