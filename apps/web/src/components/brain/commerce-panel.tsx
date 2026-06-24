"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Loader2,
  Mic,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  Upload,
} from "lucide-react";
import { api, apiForm } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Props {
  accessToken: string | null;
  organizationId: string | null;
}

type CommerceSection = "dashboard" | "catalog" | "playbook";

interface CommerceDashboard {
  revenueInfluencedByAi: number;
  voiceMessagesProcessed: number;
  leadConversionRate: number;
  salesAnalytics?: { upsellsGenerated?: number };
  mostViewedProducts: Array<{ id: string; name: string; viewCount?: number; price?: number | null; salePrice?: number | null }>;
  mostRecommendedProducts: Array<{ id: string; name: string; recommendCount?: number; price?: number | null; salePrice?: number | null }>;
  mostSoldProducts: Array<{ product?: { name?: string }; quantity: number }>;
  catalogSync?: { sources: Array<{ id: string; name: string; type: string; syncStatus: string; lastSyncAt?: string }> };
}

interface CatalogSource {
  id: string;
  name: string;
  type: string;
  syncStatus: string;
  lastSyncAt?: string;
  _count?: { products: number };
}

interface SalesPlaybookData {
  upsellRules: unknown;
  crossSellRules: unknown;
  salesScripts: unknown;
  objectionHandling: unknown;
}

const SOURCE_TYPES = [
  { value: "SHOPIFY", label: "Shopify" },
  { value: "WOOCOMMERCE", label: "WooCommerce" },
  { value: "XML_FEED", label: "XML Feed" },
] as const;

export function CommercePanel({ accessToken, organizationId }: Props) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<CommerceSection>("dashboard");
  const [sourceForm, setSourceForm] = useState({
    name: "",
    type: "XML_FEED",
    storeUrl: "",
    feedUrl: "",
    accessToken: "",
    consumerKey: "",
    consumerSecret: "",
    schedule: "MANUAL",
  });
  const [xmlUrl, setXmlUrl] = useState("");
  const [playbookDraft, setPlaybookDraft] = useState({
    upsellRules: "",
    crossSellRules: "",
    salesScripts: "",
    objectionHandling: "",
  });

  const { data: commerce, isLoading: commerceLoading } = useQuery({
    queryKey: ["commerce-analytics", organizationId],
    queryFn: () => api<CommerceDashboard>("/brain/commerce/analytics", { token: accessToken! }),
    enabled: Boolean(accessToken && organizationId),
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["catalog-sources", organizationId],
    queryFn: () => api<CatalogSource[]>("/brain/catalog/sources", { token: accessToken! }),
    enabled: Boolean(accessToken && organizationId),
  });

  const { data: playbook, isLoading: playbookLoading } = useQuery({
    queryKey: ["sales-playbook", organizationId],
    queryFn: () => api<SalesPlaybookData>("/brain/sales/playbook", { token: accessToken! }),
    enabled: Boolean(accessToken && organizationId && section === "playbook"),
  });

  const createSource = useMutation({
    mutationFn: () => {
      const credentials: Record<string, string> = {};
      if (sourceForm.type === "SHOPIFY") credentials.accessToken = sourceForm.accessToken;
      if (sourceForm.type === "WOOCOMMERCE") {
        credentials.consumerKey = sourceForm.consumerKey;
        credentials.consumerSecret = sourceForm.consumerSecret;
      }

      return api("/brain/catalog/sources", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({
          name: sourceForm.name,
          type: sourceForm.type,
          storeUrl: sourceForm.storeUrl || undefined,
          feedUrl: sourceForm.feedUrl || undefined,
          credentials,
          schedule: sourceForm.schedule,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-sources", organizationId] });
      setSourceForm((prev) => ({ ...prev, name: "", storeUrl: "", feedUrl: "" }));
    },
  });

  const syncSource = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/catalog/sources/${id}/sync`, { method: "POST", token: accessToken! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-sources", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["commerce-analytics", organizationId] });
    },
  });

  const importXml = useMutation({
    mutationFn: (file?: File) => {
      if (file) {
        const form = new FormData();
        form.append("file", file);
        if (xmlUrl) form.append("feedUrl", xmlUrl);
        return apiForm("/brain/catalog/import/xml", form, { token: accessToken!, organizationId });
      }
      return api("/brain/catalog/import/xml", {
        method: "POST",
        token: accessToken!,
        body: JSON.stringify({ feedUrl: xmlUrl, sourceName: "XML Feed Import" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-sources", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["brain-overview", organizationId] });
    },
  });

  const savePlaybook = useMutation({
    mutationFn: () =>
      api("/brain/sales/playbook", {
        method: "PATCH",
        token: accessToken!,
        body: JSON.stringify({
          upsellRules: JSON.parse(playbookDraft.upsellRules || "[]"),
          crossSellRules: JSON.parse(playbookDraft.crossSellRules || "[]"),
          salesScripts: JSON.parse(playbookDraft.salesScripts || "[]"),
          objectionHandling: JSON.parse(playbookDraft.objectionHandling || "[]"),
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales-playbook", organizationId] }),
  });

  useEffect(() => {
    if (!playbook || section !== "playbook") return;
    setPlaybookDraft({
      upsellRules: JSON.stringify(playbook.upsellRules, null, 2),
      crossSellRules: JSON.stringify(playbook.crossSellRules, null, 2),
      salesScripts: JSON.stringify(playbook.salesScripts, null, 2),
      objectionHandling: JSON.stringify(playbook.objectionHandling, null, 2),
    });
  }, [playbook, section]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "dashboard" as const, label: "Commerce Dashboard", icon: BarChart3 },
          { id: "catalog" as const, label: "Catalog Sync", icon: Store },
          { id: "playbook" as const, label: "Sales Playbook", icon: ShoppingBag },
        ].map((item) => (
          <Button
            key={item.id}
            variant={section === item.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSection(item.id)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </div>

      {section === "dashboard" && (
        <div className="space-y-4">
          {commerceLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading commerce insights...
            </div>
          ) : commerce ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Revenue Influenced" value={Math.round(commerce.revenueInfluencedByAi)} suffix=" BDT" />
                <MetricCard title="Voice Messages" value={commerce.voiceMessagesProcessed} />
                <MetricCard title="Lead Conversion" value={commerce.leadConversionRate} suffix="%" />
                <MetricCard title="Upsells Generated" value={commerce.salesAnalytics?.upsellsGenerated ?? 0} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <ProductListCard title="Most Viewed" items={commerce.mostViewedProducts} field="viewCount" />
                <ProductListCard title="Most Recommended" items={commerce.mostRecommendedProducts} field="recommendCount" />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Most Sold</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(commerce.mostSoldProducts ?? []).map((item: { product?: { name?: string }; quantity: number }, index: number) => (
                      <div key={index} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <span>{item.product?.name ?? "Unknown product"}</span>
                        <Badge variant="secondary">{item.quantity} sold</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Catalog Sync Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(commerce.catalogSync?.sources ?? []).map((source: { id: string; name: string; type: string; syncStatus: string; lastSyncAt?: string }) => (
                    <div key={source.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-muted-foreground">{source.type}</p>
                      </div>
                      <Badge variant={source.syncStatus === "SUCCESS" ? "default" : "secondary"}>{source.syncStatus}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {section === "catalog" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Sync Source</CardTitle>
              <CardDescription>Connect Shopify, WooCommerce, or XML feed as a product data source.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={sourceForm.name} onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Source Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={sourceForm.type}
                  onChange={(e) => setSourceForm({ ...sourceForm, type: e.target.value })}
                >
                  {SOURCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              {(sourceForm.type === "SHOPIFY" || sourceForm.type === "WOOCOMMERCE") && (
                <div className="space-y-1">
                  <Label>Store URL</Label>
                  <Input value={sourceForm.storeUrl} onChange={(e) => setSourceForm({ ...sourceForm, storeUrl: e.target.value })} placeholder="https://store.example.com" />
                </div>
              )}
              {sourceForm.type === "SHOPIFY" && (
                <div className="space-y-1">
                  <Label>Access Token</Label>
                  <Input value={sourceForm.accessToken} onChange={(e) => setSourceForm({ ...sourceForm, accessToken: e.target.value })} />
                </div>
              )}
              {sourceForm.type === "WOOCOMMERCE" && (
                <>
                  <div className="space-y-1">
                    <Label>Consumer Key</Label>
                    <Input value={sourceForm.consumerKey} onChange={(e) => setSourceForm({ ...sourceForm, consumerKey: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Consumer Secret</Label>
                    <Input value={sourceForm.consumerSecret} onChange={(e) => setSourceForm({ ...sourceForm, consumerSecret: e.target.value })} />
                  </div>
                </>
              )}
              {sourceForm.type === "XML_FEED" && (
                <div className="space-y-1">
                  <Label>Feed URL</Label>
                  <Input value={sourceForm.feedUrl} onChange={(e) => setSourceForm({ ...sourceForm, feedUrl: e.target.value })} placeholder="https://store.com/feed.xml" />
                </div>
              )}
              <Button onClick={() => createSource.mutate()} disabled={!sourceForm.name || createSource.isPending}>
                {createSource.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
                Add Source
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick XML Import</CardTitle>
              <CardDescription>Import products from an XML URL or uploaded .xml file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>XML Feed URL</Label>
                <Input value={xmlUrl} onChange={(e) => setXmlUrl(e.target.value)} placeholder="https://store.com/feed.xml" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => importXml.mutate(undefined)} disabled={!xmlUrl || importXml.isPending}>
                  {importXml.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Import from URL
                </Button>
                <label className="inline-flex">
                  <input
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importXml.mutate(file);
                    }}
                  />
                  <Button type="button" variant="outline" asChild>
                    <span><Upload className="mr-2 h-4 w-4" />Upload XML</span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Connected Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sourcesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sources.length ? (
                sources.map((source) => (
                  <div key={source.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="font-medium">{source.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {source.type} · {source._count?.products ?? 0} products
                        {source.lastSyncAt ? ` · Last sync ${new Date(source.lastSyncAt).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{source.syncStatus}</Badge>
                      <Button size="sm" variant="outline" onClick={() => syncSource.mutate(source.id)} disabled={syncSource.isPending}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Sync Now
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No catalog sources connected yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {section === "playbook" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Playbook</CardTitle>
            <CardDescription>Configure upsell rules, cross-sell rules, sales scripts, and objection handling.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {playbookLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <PlaybookField label="Upsell Rules (JSON)" value={playbookDraft.upsellRules} onChange={(value) => setPlaybookDraft({ ...playbookDraft, upsellRules: value })} />
                <PlaybookField label="Cross-Sell Rules (JSON)" value={playbookDraft.crossSellRules} onChange={(value) => setPlaybookDraft({ ...playbookDraft, crossSellRules: value })} />
                <PlaybookField label="Sales Scripts (JSON)" value={playbookDraft.salesScripts} onChange={(value) => setPlaybookDraft({ ...playbookDraft, salesScripts: value })} />
                <PlaybookField label="Objection Handling (JSON)" value={playbookDraft.objectionHandling} onChange={(value) => setPlaybookDraft({ ...playbookDraft, objectionHandling: value })} />
                <Button onClick={() => savePlaybook.mutate()} disabled={savePlaybook.isPending}>
                  {savePlaybook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Playbook
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ title, value, suffix = "" }: { title: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}{suffix}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ProductListCard({
  title,
  items,
  field,
}: {
  title: string;
  items: Array<{ id: string; name: string; viewCount?: number; recommendCount?: number; price?: number | null; salePrice?: number | null }>;
  field: "viewCount" | "recommendCount";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(items ?? []).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-muted-foreground">{(item.salePrice ?? item.price) ? `${item.salePrice ?? item.price} BDT` : "Price N/A"}</p>
            </div>
            <Badge variant="secondary">{item[field] ?? 0}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlaybookField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} className="font-mono text-xs" />
    </div>
  );
}
