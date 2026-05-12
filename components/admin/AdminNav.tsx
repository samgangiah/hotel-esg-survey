import Link from "next/link";
import { cn } from "@/lib/utils";
import { Inbox, ListChecks, Building2, Bell } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Operators", icon: Building2 },
  { href: "/admin/reminders", label: "Reminders", icon: Bell },
  { href: "/admin/email-events", label: "Email events", icon: Inbox },
  { href: "/admin/audit", label: "Audit log", icon: ListChecks },
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 sm:px-6">
        <Link
          href="/admin"
          className="-ml-1 mr-4 flex items-center gap-2 py-3 font-display text-base text-ink"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-card bg-accent text-white text-xs">
            esg
          </span>
          <span className="hidden sm:inline">Platform admin</span>
        </Link>
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
