import { Facebook, Instagram, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChannelIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "MESSENGER":
      return <Facebook className={cn("h-4 w-4 text-blue-600 dark:text-blue-400", className)} />;
    case "INSTAGRAM":
      return <Instagram className={cn("h-4 w-4 text-pink-600 dark:text-pink-400", className)} />;
    case "WHATSAPP":
      return <MessageCircle className={cn("h-4 w-4 text-emerald-600 dark:text-emerald-400", className)} />;
    default:
      return <MessageCircle className={cn("h-4 w-4 text-muted-foreground", className)} />;
  }
}

export function channelLabel(type: string) {
  switch (type) {
    case "MESSENGER":
      return "Messenger";
    case "INSTAGRAM":
      return "Instagram";
    case "WHATSAPP":
      return "WhatsApp";
    default:
      return type;
  }
}

export function statusColor(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-emerald-500";
    case "PENDING":
      return "bg-amber-500";
    case "CLOSED":
      return "bg-muted-foreground/50";
    default:
      return "bg-muted-foreground/50";
  }
}

export function messageStatusIcon(status: string) {
  switch (status) {
    case "SENT":
      return "✓";
    case "DELIVERED":
      return "✓✓";
    case "READ":
      return "✓✓";
    case "FAILED":
      return "!";
    default:
      return "·";
  }
}
