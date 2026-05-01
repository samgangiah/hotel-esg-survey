"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[88px] w-full rounded-control border border-line bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 transition-shadow focus-visible:shadow-focus focus-visible:border-accent resize-y",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
