"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { MessageSquare, Users, Bot, TrendingUp, Facebook, Instagram, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { BRAND } from "@/config/branding";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DashboardData {
  conversations: { total: number; open: number; closed: number; pending: number };
  team: { activeAgents: number; assignedConversations: number };
  channels: { messenger: number; instagram: number; whatsapp: number };
  ai: { aiReplies: number; humanReplies: number; aiResolutionRate: number };
}

interface ChannelAnalyticsAccount {
  channelId: string;
  type: string;
  name: string;
  accountId: string | null;
  messageCount: number;
  conversationCount: number;
  openConversations: number;
}

interface ChannelAnalyticsData {
  accounts: ChannelAnalyticsAccount[];
  topPerforming: ChannelAnalyticsAccount[];
}

function MetricCard({
  title,
  value,
  icon: Icon,
  subtitle,
  accent,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("rounded-lg p-2", accent ?? "bg-muted")}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const pathname = usePathname();
  const { accessToken, currentOrganizationId } = useAuthStore();
  const pageTitle = pathname.startsWith("/analytics")
    ? BRAND.pages.analytics
    : BRAND.pages.dashboard;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", currentOrganizationId],
    queryFn: () =>
      api<DashboardData>("/analytics/dashboard", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: channelAnalytics } = useQuery({
    queryKey: ["analytics-channels", currentOrganizationId],
    queryFn: () =>
      api<ChannelAnalyticsData>("/analytics/channels", {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  if (isLoading) return <DashboardSkeleton />;

  const d = data ?? {
    conversations: { total: 0, open: 0, closed: 0, pending: 0 },
    team: { activeAgents: 0, assignedConversations: 0 },
    channels: { messenger: 0, instagram: 0, whatsapp: 0 },
    ai: { aiReplies: 0, humanReplies: 0, aiResolutionRate: 0 },
  };

  const channelStats = [
    { label: "Messenger", value: d.channels.messenger, icon: Facebook, color: "text-blue-600 dark:text-blue-400" },
    { label: "Instagram", value: d.channels.instagram, icon: Instagram, color: "text-pink-600 dark:text-pink-400" },
    { label: "WhatsApp", value: d.channels.whatsapp, icon: MessageCircle, color: "text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <PageHeader
        title={pageTitle}
        description="Overview of your messaging performance this month"
      />

      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Conversations"
          value={formatNumber(d.conversations.total)}
          icon={MessageSquare}
          subtitle="This month"
          accent="bg-primary/10 text-primary"
        />
        <MetricCard title="Open" value={formatNumber(d.conversations.open)} icon={MessageSquare} accent="bg-emerald-500/10 text-emerald-600" />
        <MetricCard title="Pending" value={formatNumber(d.conversations.pending)} icon={MessageSquare} accent="bg-amber-500/10 text-amber-600" />
        <MetricCard title="Closed" value={formatNumber(d.conversations.closed)} icon={MessageSquare} accent="bg-muted text-muted-foreground" />
      </div>

      <div className="grid grid-cols-1 gap-4 min-[375px]:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Active Agents"
          value={d.team.activeAgents}
          icon={Users}
          subtitle={`${d.team.assignedConversations} assigned conversations`}
          accent="bg-blue-500/10 text-blue-600"
        />
        <MetricCard
          title="AI Replies"
          value={formatNumber(d.ai.aiReplies)}
          icon={Bot}
          subtitle={`${d.ai.aiResolutionRate}% resolution rate`}
          accent="bg-primary/10 text-primary"
        />
        <MetricCard
          title="Human Replies"
          value={formatNumber(d.ai.humanReplies)}
          icon={TrendingUp}
          accent="bg-violet-500/10 text-violet-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {channelStats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border bg-muted/20 p-4 text-center">
                <Icon className={cn("mx-auto mb-2 h-6 w-6", color)} />
                <p className="text-2xl font-bold">{formatNumber(value)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {channelAnalytics && channelAnalytics.accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages by Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channelAnalytics.topPerforming.map((account) => (
                <div
                  key={account.channelId}
                  className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.type} · {account.accountId ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>
                      <span className="font-semibold">{formatNumber(account.messageCount)}</span>{" "}
                      <span className="text-muted-foreground">messages</span>
                    </span>
                    <span>
                      <span className="font-semibold">{formatNumber(account.conversationCount)}</span>{" "}
                      <span className="text-muted-foreground">conversations</span>
                    </span>
                    <span>
                      <span className="font-semibold">{formatNumber(account.openConversations)}</span>{" "}
                      <span className="text-muted-foreground">open</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
