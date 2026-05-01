"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-control border border-line bg-white px-3 text-ink placeholder:text-muted/70 transition-shadow focus-visible:shadow-focus focus-visible:border-accent",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
