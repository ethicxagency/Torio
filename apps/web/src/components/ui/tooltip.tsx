"use client";

import { cn } from "@/lib/utils";

interface TooltipProps {
  label: string;
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
}

export function Tooltip({ label, children, side = "right", className }: TooltipProps) {
  return (
    <div className={cn("group/tooltip relative flex w-full justify-center", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md",
          "group-hover/tooltip:block group-focus-within/tooltip:block",
          side === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
          side === "bottom" && "left-1/2 top-full mt-2 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </div>
  );
}
