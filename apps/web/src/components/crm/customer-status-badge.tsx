import { CUSTOMER_STATUS_LABELS, type CustomerStatus } from "@mango/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<CustomerStatus, string> = {
  NEW_LEAD: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  INTERESTED: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  FOLLOW_UP: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  NEGOTIATION: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  CUSTOMER: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  LOST: "bg-muted text-muted-foreground",
};

export function CustomerStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status as CustomerStatus;
  return (
    <Badge variant="outline" className={cn("border-0 font-medium", STATUS_VARIANTS[key], className)}>
      {CUSTOMER_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
