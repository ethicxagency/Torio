"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brain,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CopilotPanelProps {
  conversationId: string | null;
  accessToken: string | null;
  organizationId: string | null;
  onUseReply?: (content: string) => void;
  className?: string;
}

interface CopilotData {
  intent: { intent: string; confidence: number; label: string; signals: string[] };
  leadScore: {
    score: number;
    summary: string;
    factors: {
      conversationActivity: number;
      productInterest: number;
      orderHistory: number;
      purchaseIntent: number;
    };
  };
  alerts: Array<{ type: string; message: string; severity: string }>;
  customerInsights: {
    totalOrders: number;
    totalRevenue: number;
    lastPurchaseAt?: string | null;
    favoriteProducts: string[];
    repeatPurchaseBehavior?: string | null;
  } | null;
  orderHistory: Array<{
    id: string;
    orderNumber: string;
    status: string;
    courier?: string | null;
    trackingNumber?: string | null;
    orderValue: number;
    orderDate: string;
  }>;
  productRecommendations: Array<{
    productId: string;
    name: string;
    price: number | null;
    reason: string;
  }>;
  upsells: Array<{ productId: string; name: string; price: number | null; reason: string }>;
  crossSells: Array<{ productId: string; name: string; price: number | null; reason: string }>;
  suggestedReplies: Array<{ content: string; reason: string }>;
  suggestions: Array<{ id: string; type: string; title: string; content: string; reason?: string | null }>;
  brainConfidence?: { score: number; action: string } | null;
}

export function CopilotPanel({
  conversationId,
  accessToken,
  organizationId,
  onUseReply,
  className,
}: CopilotPanelProps) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["copilot", organizationId, conversationId],
    queryFn: () =>
      api<CopilotData>(`/brain/copilot/conversations/${conversationId}`, {
        token: accessToken,
        organizationId,
      }),
    enabled: !!conversationId && !!accessToken && !!organizationId,
  });

  const { data: salesAgent } = useQuery({
    queryKey: ["sales-agent", organizationId, conversationId],
    queryFn: () =>
      api<{
        salesIntent: { label: string; confidence: number; intent: string };
        salesReply?: string | null;
        recommendations: Array<{ name: string; price: number | null; reason: string }>;
        suggestions: Array<{ id: string; type: string; title: string; content: string }>;
      }>(`/brain/sales/agent/analyze`, {
        method: "POST",
        token: accessToken,
        organizationId,
        body: JSON.stringify({ conversationId }),
      }),
    enabled: !!conversationId && !!accessToken && !!organizationId,
  });

  if (!conversationId) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground", className)}>
        <Sparkles className="mb-2 h-8 w-8 text-primary/60" />
        Select a conversation to open Torio Copilot.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col overflow-y-auto", className)}>
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Torio Copilot</h3>
            <p className="text-xs text-muted-foreground">AI Business Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>

      <div className="space-y-4 p-4">
        {data.alerts.map((alert) => (
          <div
            key={`${alert.type}-${alert.message}`}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-sm",
              alert.severity === "critical" && "border-destructive/40 bg-destructive/5",
              alert.severity === "warning" && "border-amber-500/40 bg-amber-500/5",
              alert.severity === "info" && "border-primary/30 bg-primary/5",
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{alert.message}</span>
          </div>
        ))}

        <Section title="Intent Detection" icon={Target}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{data.intent.label}</Badge>
            <Badge variant="outline">{data.intent.confidence}% confidence</Badge>
          </div>
          {salesAgent?.salesIntent && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Sales: {salesAgent.salesIntent.label}</Badge>
              <Badge variant="outline">{salesAgent.salesIntent.confidence}%</Badge>
            </div>
          )}
        </Section>

        <Section title="Lead Score" icon={TrendingUp}>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold">{Math.round(data.leadScore.score)}</span>
            <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{data.leadScore.summary}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Factor label="Activity" value={data.leadScore.factors.conversationActivity} />
            <Factor label="Product Interest" value={data.leadScore.factors.productInterest} />
            <Factor label="Order History" value={data.leadScore.factors.orderHistory} />
            <Factor label="Purchase Intent" value={data.leadScore.factors.purchaseIntent} />
          </div>
        </Section>

        {data.customerInsights && (
          <Section title="Customer Insights" icon={Brain}>
            <InsightRow label="Total Orders" value={String(data.customerInsights.totalOrders)} />
            <InsightRow label="Total Revenue" value={`${Math.round(data.customerInsights.totalRevenue)} BDT`} />
            {data.customerInsights.repeatPurchaseBehavior && (
              <InsightRow label="Behavior" value={data.customerInsights.repeatPurchaseBehavior} />
            )}
            {data.customerInsights.favoriteProducts.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Favorites: {data.customerInsights.favoriteProducts.join(", ")}
              </p>
            )}
          </Section>
        )}

        <Section title="Order History" icon={Truck}>
          {data.orderHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">No orders found for this customer.</p>
          )}
          {data.orderHistory.map((order) => (
            <div key={order.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{order.orderNumber}</span>
                <Badge variant="outline">{order.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {order.courier ?? "No courier"}
                {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
              </p>
            </div>
          ))}
        </Section>

        <Section title="Product Recommendations" icon={Package}>
          {data.productRecommendations.map((product) => (
            <SuggestionCard
              key={product.productId}
              title={product.name}
              subtitle={product.price ? `${product.price} BDT` : undefined}
              reason={product.reason}
            />
          ))}
          {!data.productRecommendations.length && (
            <p className="text-sm text-muted-foreground">No product matches yet.</p>
          )}
        </Section>

        {(data.upsells.length > 0 || data.crossSells.length > 0) && (
          <Section title="Upsell & Cross-Sell" icon={TrendingUp}>
            {data.upsells.map((item) => (
              <SuggestionCard key={item.productId} title={`Upsell: ${item.name}`} reason={item.reason} />
            ))}
            {data.crossSells.map((item) => (
              <SuggestionCard key={item.productId} title={`Cross-sell: ${item.name}`} reason={item.reason} />
            ))}
          </Section>
        )}

        <Section title="Suggested Replies" icon={Sparkles}>
          {salesAgent?.salesReply && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-primary">AI Sales Agent</p>
              <p className="whitespace-pre-wrap">{salesAgent.salesReply}</p>
              {onUseReply && (
                <Button size="sm" className="mt-3 min-h-[36px]" onClick={() => onUseReply(salesAgent.salesReply!)}>
                  Use Sales Reply
                </Button>
              )}
            </div>
          )}
          {data.suggestedReplies.map((reply, index) => (
            <div key={index} className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="whitespace-pre-wrap">{reply.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">{reply.reason}</p>
              {onUseReply && (
                <Button size="sm" className="mt-3 min-h-[36px]" onClick={() => onUseReply(reply.content)}>
                  Use Reply
                </Button>
              )}
            </div>
          ))}
          {data.brainConfidence && (
            <p className="text-xs text-muted-foreground">
              Brain confidence: {data.brainConfidence.score}% · {data.brainConfidence.action.replace(/_/g, " ")}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function Factor({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-background px-2 py-1">
      {label}: {value}
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SuggestionCard({
  title,
  subtitle,
  reason,
}: {
  title: string;
  subtitle?: string;
  reason: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        {subtitle && <Badge variant="outline">{subtitle}</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{reason}</p>
    </div>
  );
}
