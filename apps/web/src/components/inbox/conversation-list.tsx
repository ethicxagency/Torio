"use client";

import { formatDistanceToNow } from "date-fns";
import { Inbox } from "lucide-react";
import { ChannelIcon } from "./inbox-utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { BRAND } from "@/config/branding";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export interface ConversationItem {
  id: string;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  channel: { id: string; type: string; name: string };
  customer: { id: string; fullName: string | null; avatarUrl: string | null; phone: string | null };
  assignedAgent: { id: string; name: string | null } | null;
  tags: { id: string; name: string; color: string }[];
}

interface Props {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function ConversationList({ conversations, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={Inbox}
          title={BRAND.emptyStates.inbox.title}
          description={BRAND.emptyStates.inbox.description}
          className="border-none bg-transparent py-8"
        >
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/channels">Connect channels</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex-1 divide-y overflow-y-auto">
      {conversations.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            "w-full min-h-[72px] px-4 py-3 text-left transition-colors hover:bg-accent/40",
            selectedId === c.id && "bg-accent/60",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <Avatar name={c.customer.fullName ?? c.customer.phone} />
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5 ring-1 ring-border">
                <ChannelIcon type={c.channel.type} className="h-3 w-3" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>
                  {c.customer.fullName ?? c.customer.phone ?? "Unknown"}
                </span>
                {c.lastMessageAt && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <p className={cn("mt-0.5 truncate text-xs", c.unreadCount > 0 ? "text-foreground" : "text-muted-foreground")}>
                {c.lastMessagePreview ?? "No messages"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {c.unreadCount > 0 && (
                  <Badge className="h-5 min-w-5 justify-center px-1.5">{c.unreadCount}</Badge>
                )}
                {c.assignedAgent && (
                  <span className="text-xs text-muted-foreground">→ {c.assignedAgent.name ?? "Agent"}</span>
                )}
                {c.tags.slice(0, 2).map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
