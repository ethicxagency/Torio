import { MessageSquare } from "lucide-react";
import { BRAND } from "@/config/branding";
import { cn } from "@/lib/utils";

export type LogoVariant = "light" | "dark" | "icon";

interface LogoProps {
  variant?: LogoVariant;
  showTagline?: boolean;
  className?: string;
  iconClassName?: string;
}

export function Logo({
  variant = "light",
  showTagline = false,
  className,
  iconClassName,
}: LogoProps) {
  if (variant === "icon") {
    return (
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
          className,
        )}
      >
        <MessageSquare className={cn("h-5 w-5", iconClassName)} />
      </div>
    );
  }

  const isDark = variant === "dark";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg shadow-sm",
          isDark
            ? "bg-white text-primary"
            : "bg-primary text-primary-foreground",
        )}
      >
        <MessageSquare className={cn("h-5 w-5", iconClassName)} />
      </div>
      <div>
        <span
          className={cn(
            "text-lg font-bold tracking-tight",
            isDark ? "text-white" : "text-foreground",
          )}
        >
          {BRAND.name}
        </span>
        {showTagline && (
          <p
            className={cn(
              "text-[10px] leading-none",
              isDark ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {BRAND.tagline}
          </p>
        )}
      </div>
    </div>
  );
}
