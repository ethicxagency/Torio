"use client";

import { Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Package,
  RefreshCw,
  Settings2,
  Trash2,
  Truck,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";

type CourierProviderType = "STEADFAST" | "REDX" | "PAPERFLY" | "PATHAO";

interface ProviderMeta {
  provider: CourierProviderType;
  label: string;
  credentialFields: { key: string; label: string; type?: string }[];
}

interface CourierConnection {
  id: string;
  provider: CourierProviderType;
  label: string;
  accountName: string | null;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
}

interface ShippingSettings {
  responseStyle: "SHORT" | "DETAILED";
  language: "BANGLA" | "ENGLISH" | "AUTO";
  syncInterval: "THIRTY_MINUTES" | "ONE_HOUR";
  portalEnabled: boolean;
}

interface DeliveryIntelligence {
  courierPreferences: Record<string, unknown> | null;
  deliveryPolicies: Record<string, unknown> | null;
  shippingRules: Record<string, unknown> | null;
  trackingInstructions: string | null;
}

const PROVIDER_COLORS: Record<CourierProviderType, string> = {
  STEADFAST: "bg-orange-500/10 text-orange-600",
  REDX: "bg-red-500/10 text-red-600",
  PAPERFLY: "bg-blue-500/10 text-blue-600",
  PATHAO: "bg-emerald-500/10 text-emerald-600",
};

function ShippingDeliveryContent() {
  const { accessToken, currentOrganizationId } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeProvider, setActiveProvider] = useState<CourierProviderType | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [accountName, setAccountName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["shipping-delivery", currentOrganizationId],
    queryFn: () =>
      api<{
        settings: ShippingSettings;
        connections: CourierConnection[];
        providers: ProviderMeta[];
      }>(`/settings/shipping-delivery`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const { data: intelligence } = useQuery({
    queryKey: ["delivery-intelligence", currentOrganizationId],
    queryFn: () =>
      api<DeliveryIntelligence>(`/delivery-intelligence`, {
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    enabled: !!accessToken && !!currentOrganizationId,
  });

  const [intelForm, setIntelForm] = useState({
    trackingInstructions: "",
    courierPreferences: "",
    deliveryPolicies: "",
    shippingRules: "",
  });

  const connectionsByProvider = useMemo(() => {
    const map = new Map<CourierProviderType, CourierConnection>();
    for (const conn of data?.connections ?? []) {
      map.set(conn.provider, conn);
    }
    return map;
  }, [data?.connections]);

  const connect = useMutation({
    mutationFn: (provider: CourierProviderType) =>
      api(`/courier/connections`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({ provider, credentials, accountName: accountName || undefined }),
      }),
    onSuccess: () => {
      setMessage("Courier connected successfully");
      setError(null);
      setActiveProvider(null);
      setCredentials({});
      queryClient.invalidateQueries({ queryKey: ["shipping-delivery"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const testConnection = useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean; message: string }>(`/courier/connections/${id}/test`, {
        method: "POST",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: (result) => {
      setMessage(result.message);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["shipping-delivery"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) =>
      api(`/courier/connections/${id}`, {
        method: "DELETE",
        token: accessToken,
        organizationId: currentOrganizationId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-delivery"] }),
  });

  const updateSettings = useMutation({
    mutationFn: (payload: Partial<ShippingSettings>) =>
      api(`/settings/shipping-delivery`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setMessage("Tracking settings saved");
      queryClient.invalidateQueries({ queryKey: ["shipping-delivery"] });
    },
  });

  const updateIntelligence = useMutation({
    mutationFn: () =>
      api(`/delivery-intelligence`, {
        method: "PATCH",
        token: accessToken,
        organizationId: currentOrganizationId,
        body: JSON.stringify({
          trackingInstructions: intelForm.trackingInstructions || undefined,
          courierPreferences: intelForm.courierPreferences
            ? JSON.parse(intelForm.courierPreferences)
            : undefined,
          deliveryPolicies: intelForm.deliveryPolicies
            ? JSON.parse(intelForm.deliveryPolicies)
            : undefined,
          shippingRules: intelForm.shippingRules ? JSON.parse(intelForm.shippingRules) : undefined,
        }),
      }),
    onSuccess: () => {
      setMessage("Delivery intelligence saved");
      queryClient.invalidateQueries({ queryKey: ["delivery-intelligence"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const openConfigure = (provider: ProviderMeta) => {
    setActiveProvider(provider.provider);
    setCredentials({});
    setAccountName("");
    setError(null);
  };

  if (isLoading) {
    return <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 overflow-x-hidden">
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 min-h-[44px] text-muted-foreground">
          <Link href="/settings">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to settings
          </Link>
        </Button>
        <PageHeader
          title="Shipping & Delivery"
          description="Connect couriers, configure tracking, and train Torio AI for delivery questions"
        />
      </div>

      {message && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-900 dark:text-emerald-100">{message}</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Courier Integrations</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(data?.providers ?? []).map((provider) => {
            const connection = connectionsByProvider.get(provider.provider);
            return (
              <Card key={provider.provider} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${PROVIDER_COLORS[provider.provider]}`}>
                      <Package className="h-6 w-6" />
                    </div>
                    {connection && (
                      <Badge variant={connection.status === "CONNECTED" ? "success" : "muted"}>
                        {connection.status}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{provider.label}</CardTitle>
                  <CardDescription>
                    {connection?.accountName ?? "Connect to sync live tracking data"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {connection ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testConnection.mutate(connection.id)}
                        disabled={testConnection.isPending}
                      >
                        {testConnection.isPending ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-4 w-4" />
                        )}
                        Test
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openConfigure(provider)}>
                        Configure
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => disconnect.mutate(connection.id)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => openConfigure(provider)}>
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {activeProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {data?.providers.find((p) => p.provider === activeProvider)?.label} Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Account name (optional)</Label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            {data?.providers
              .find((p) => p.provider === activeProvider)
              ?.credentialFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.type ?? "text"}
                    value={credentials[field.key] ?? ""}
                    onChange={(e) =>
                      setCredentials({ ...credentials, [field.key]: e.target.value })
                    }
                  />
                </div>
              ))}
            <div className="flex gap-2">
              <Button
                onClick={() => activeProvider && connect.mutate(activeProvider)}
                disabled={connect.isPending}
              >
                {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Connection
              </Button>
              <Button variant="outline" onClick={() => setActiveProvider(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Tracking Settings</CardTitle>
          </div>
          <CardDescription>How Torio AI responds to delivery and tracking questions</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Response style</Label>
            <Select
              value={data?.settings.responseStyle ?? "DETAILED"}
              onChange={(e) =>
                updateSettings.mutate({
                  responseStyle: e.target.value as ShippingSettings["responseStyle"],
                })
              }
            >
              <option value="SHORT">Short</option>
              <option value="DETAILED">Detailed</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={data?.settings.language ?? "AUTO"}
              onChange={(e) =>
                updateSettings.mutate({ language: e.target.value as ShippingSettings["language"] })
              }
            >
              <option value="AUTO">Auto detect</option>
              <option value="BANGLA">Bangla</option>
              <option value="ENGLISH">English</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sync interval</Label>
            <Select
              value={data?.settings.syncInterval ?? "THIRTY_MINUTES"}
              onChange={(e) =>
                updateSettings.mutate({
                  syncInterval: e.target.value as ShippingSettings["syncInterval"],
                })
              }
            >
              <option value="THIRTY_MINUTES">Every 30 minutes</option>
              <option value="ONE_HOUR">Every 1 hour</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery Intelligence</CardTitle>
          <CardDescription>
            Courier preferences and delivery policies used by Torio Brain alongside live tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tracking instructions for AI</Label>
            <Textarea
              placeholder="e.g. We deliver within 2-3 days inside Dhaka. SteadFast is our primary courier."
              defaultValue={intelligence?.trackingInstructions ?? ""}
              onChange={(e) => setIntelForm({ ...intelForm, trackingInstructions: e.target.value })}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Courier preferences (JSON)</Label>
            <Textarea
              placeholder='{"preferred":"STEADFAST","fallback":"REDX"}'
              defaultValue={
                intelligence?.courierPreferences
                  ? JSON.stringify(intelligence.courierPreferences, null, 2)
                  : ""
              }
              onChange={(e) => setIntelForm({ ...intelForm, courierPreferences: e.target.value })}
              rows={3}
            />
          </div>
          <Button onClick={() => updateIntelligence.mutate()} disabled={updateIntelligence.isPending}>
            Save Delivery Intelligence
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ShippingDeliveryPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">Loading...</div>}>
      <ShippingDeliveryContent />
    </Suspense>
  );
}
