import * as React from "react";
import { cn } from "@/lib/utils";

export function Pill({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-accent-deep",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
