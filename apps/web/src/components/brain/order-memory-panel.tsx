"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageSearch, Plus, RefreshCw, Trash2, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

interface OrderItem {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice?: number | null;
  product?: { id: string; name: string; sku: string | null } | null;
}

interface OrderMemory {
  id: string;
  orderNumber: string;
  customerId: string;
  status: string;
  courier?: string | null;
  trackingNumber?: string | null;
  paymentMethod?: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  orderValue: number;
  customer: { id: string; fullName: string | null; phone: string | null };
  items: OrderItem[];
}

interface CustomerInsight {
  id: string;
  customerId: string;
  totalOrders: number;
  totalRevenue: number;
  lastPurchaseAt?: string | null;
  favoriteProducts: string[];
  repeatPurchaseBehavior?: string | null;
  customer: { id: string; fullName: string | null; phone: string | null };
}

interface OrderAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  statusBreakdown: Array<{ status: string; count: number }>;
}

interface SearchHit {
  order: OrderMemory;
  score: number;
  matchedFields: string[];
}

interface CustomerOption {
  id: string;
  fullName: string | null;
  phone: string | null;
}

interface Props {
  accessToken: string | null;
  organizationId: string | null;
}

const EMPTY_FORM = {
  customerId: "",
  orderNumber: "",
  status: "SHIPPED",
  courier: "",
  trackingNumber: "",
  paymentMethod: "Cash on Delivery",
  orderDate: new Date().toISOString().slice(0, 10),
  deliveryDate: "",
  orderValue: "",
  productName: "",
  quantity: "1",
  unitPrice: "",
};

export function OrderMemoryPanel({ accessToken, organizationId }: Props) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["brain-orders", organizationId],
    queryFn: () =>
      api<OrderMemory[]>("/brain/orders?limit=50", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });
  const { data: insights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ["brain-insights", organizationId],
    queryFn: () =>
      api<CustomerInsight[]>("/brain/insights", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });
  const { data: analytics } = useQuery({
    queryKey: ["brain-order-analytics", organizationId],
    queryFn: () =>
      api<OrderAnalytics>("/brain/orders/analytics", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState("Amar order kothay?");
  const [searchCustomerId, setSearchCustomerId] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const effectiveSelectedId = selectedId ?? orders[0]?.id ?? null;
  const selected = useMemo(
    () => orders.find((order) => order.id === effectiveSelectedId) ?? null,
    [orders, effectiveSelectedId],
  );

  const { data: customersData } = useQuery({
    queryKey: ["customers-options", organizationId],
    queryFn: () =>
      api<{ items: CustomerOption[] }>("/customers?limit=50", {
        token: accessToken,
        organizationId,
      }),
    enabled: !!accessToken && !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["brain-orders"] });
    queryClient.invalidateQueries({ queryKey: ["brain-insights"] });
    queryClient.invalidateQueries({ queryKey: ["brain-order-analytics"] });
    queryClient.invalidateQueries({ queryKey: ["brain-overview"] });
  };

  const createOrder = useMutation({
    mutationFn: () =>
      api("/brain/orders", {
        method: "POST",
        token: accessToken,
        organizationId,
        body: JSON.stringify({
          customerId: form.customerId,
          orderNumber: form.orderNumber,
          status: form.status,
          courier: form.courier || undefined,
          trackingNumber: form.trackingNumber || undefined,
          paymentMethod: form.paymentMethod || undefined,
          orderDate: form.orderDate,
          deliveryDate: form.deliveryDate || undefined,
          orderValue: form.orderValue ? Number(form.orderValue) : 0,
          items: form.productName
            ? [
                {
                  productName: form.productName,
                  quantity: Number(form.quantity) || 1,
                  unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
                },
              ]
            : undefined,
        }),
      }),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setShowCreate(false);
      invalidate();
    },
  });

  const deleteOrder = useMutation({
    mutationFn: (id: string) =>
      api(`/brain/orders/${id}`, { method: "DELETE", token: accessToken, organizationId }),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });

  const searchOrders = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams({ query: searchQuery, limit: "10" });
      if (searchCustomerId) params.set("customerId", searchCustomerId);
      return api<SearchHit[]>(`/brain/orders/search?${params.toString()}`, {
        token: accessToken,
        organizationId,
      });
    },
    onSuccess: setSearchResults,
  });

  const refreshInsights = useMutation({
    mutationFn: () =>
      api("/brain/insights/refresh", {
        method: "POST",
        token: accessToken,
        organizationId,
      }),
    onSuccess: invalidate,
  });

  if (ordersLoading || insightsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {analytics && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Orders" value={analytics.totalOrders} />
          <MetricCard title="Total Revenue" value={Math.round(analytics.totalRevenue)} suffix=" BDT" />
          <MetricCard title="Avg Order Value" value={analytics.averageOrderValue} suffix=" BDT" />
          <MetricCard
            title="In Transit"
            value={
              analytics.statusBreakdown.find((s) =>
                ["SHIPPED", "OUT_FOR_DELIVERY"].includes(s.status),
              )?.count ?? 0
            }
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" />
            Order Lookup
          </CardTitle>
          <CardDescription>
            Test order lookup. Queries like &quot;Amar order kothay?&quot; match status, courier, and tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Amar order kothay?"
          />
          <Input
            value={searchCustomerId}
            onChange={(e) => setSearchCustomerId(e.target.value)}
            placeholder="Optional customer ID for scoped lookup"
          />
          <Button onClick={() => searchOrders.mutate()} disabled={searchOrders.isPending}>
            {searchOrders.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup Order"}
          </Button>
          {searchResults && (
            <div className="space-y-2">
              {searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No matching orders found.</p>
              )}
              {searchResults.map(({ order, score, matchedFields }) => (
                <div key={order.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{order.orderNumber}</p>
                    <Badge>{order.status.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline">Score {score}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {order.customer.fullName ?? order.customer.phone} · {order.courier ?? "No courier"}
                    {order.trackingNumber ? ` · ${order.trackingNumber}` : ""}
                  </p>
                  {matchedFields.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Matched: {matchedFields.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Orders ({orders.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedId(order.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === order.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {order.customer.fullName ?? order.customer.phone} · {order.status.replace(/_/g, " ")}
                </p>
              </button>
            ))}
            {!orders.length && (
              <p className="text-sm text-muted-foreground">No orders yet. Add order memory records.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle>Add Order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <OrderForm
                  form={form}
                  setForm={setForm}
                  customers={customersData?.items ?? []}
                />
                <Button
                  onClick={() => createOrder.mutate()}
                  disabled={!form.customerId || !form.orderNumber || createOrder.isPending}
                >
                  {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                  Create Order
                </Button>
              </CardContent>
            </Card>
          )}

          {selected && (
            <SelectedOrderEditor
              key={selected.id}
              order={selected}
              accessToken={accessToken}
              organizationId={organizationId}
              onDelete={() => deleteOrder.mutate(selected.id)}
              onInvalidate={invalidate}
            />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Customer Insights</CardTitle>
              <CardDescription>Purchase behavior computed from Order Memory.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refreshInsights.mutate()} disabled={refreshInsights.isPending}>
              {refreshInsights.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{insight.customer.fullName ?? insight.customer.phone ?? "Customer"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{insight.totalOrders} orders</Badge>
                <Badge variant="outline">{Math.round(insight.totalRevenue)} BDT</Badge>
                {insight.repeatPurchaseBehavior && (
                  <Badge variant="secondary">{insight.repeatPurchaseBehavior}</Badge>
                )}
              </div>
              {insight.favoriteProducts.length > 0 && (
                <p className="mt-2 text-muted-foreground">
                  Favorites: {insight.favoriteProducts.join(", ")}
                </p>
              )}
              {insight.lastPurchaseAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last purchase: {insight.lastPurchaseAt.slice(0, 10)}
                </p>
              )}
            </div>
          ))}
          {!insights.length && (
            <p className="text-sm text-muted-foreground">No insights yet. Add orders and refresh insights.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SelectedOrderEditor({
  order,
  accessToken,
  organizationId,
  onDelete,
  onInvalidate,
}: {
  order: OrderMemory;
  accessToken: string | null;
  organizationId: string | null;
  onDelete: () => void;
  onInvalidate: () => void;
}) {
  const [status, setStatus] = useState(order.status);
  const [courier, setCourier] = useState(order.courier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod ?? "");
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryDate?.slice(0, 10) ?? "");

  const updateOrder = useMutation({
    mutationFn: () =>
      api(`/brain/orders/${order.id}`, {
        method: "PATCH",
        token: accessToken,
        organizationId,
        body: JSON.stringify({
          status,
          courier: courier || undefined,
          trackingNumber: trackingNumber || undefined,
          paymentMethod: paymentMethod || undefined,
          deliveryDate: deliveryDate || undefined,
        }),
      }),
    onSuccess: onInvalidate,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{order.orderNumber}</CardTitle>
            <CardDescription>
              {order.customer.fullName ?? order.customer.phone} · {order.orderValue} BDT
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Courier">
            <Input value={courier} onChange={(e) => setCourier(e.target.value)} />
          </Field>
          <Field label="Tracking Number">
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
          </Field>
          <Field label="Payment Method">
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
          </Field>
          <Field label="Delivery Date">
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Products</p>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="rounded border px-3 py-2 text-sm">
                {item.productName} x{item.quantity}
                {item.unitPrice != null ? ` · ${item.unitPrice} BDT` : ""}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={() => updateOrder.mutate()} disabled={updateOrder.isPending}>
          {updateOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Order"}
        </Button>
      </CardContent>
    </Card>
  );
}

function OrderForm({
  form,
  setForm,
  customers,
}: {
  form: typeof EMPTY_FORM;
  setForm: (next: typeof EMPTY_FORM | ((prev: typeof EMPTY_FORM) => typeof EMPTY_FORM)) => void;
  customers: CustomerOption[];
}) {
  const update = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Customer">
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.customerId}
          onChange={(e) => update("customerId", e.target.value)}
        >
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.fullName ?? customer.phone ?? customer.id}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Order Number">
        <Input value={form.orderNumber} onChange={(e) => update("orderNumber", e.target.value)} />
      </Field>
      <Field label="Status">
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.status}
          onChange={(e) => update("status", e.target.value)}
        >
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
          ))}
        </select>
      </Field>
      <Field label="Courier">
        <Input value={form.courier} onChange={(e) => update("courier", e.target.value)} />
      </Field>
      <Field label="Tracking Number">
        <Input value={form.trackingNumber} onChange={(e) => update("trackingNumber", e.target.value)} />
      </Field>
      <Field label="Payment Method">
        <Input value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} />
      </Field>
      <Field label="Order Date">
        <Input type="date" value={form.orderDate} onChange={(e) => update("orderDate", e.target.value)} />
      </Field>
      <Field label="Order Value">
        <Input value={form.orderValue} onChange={(e) => update("orderValue", e.target.value)} />
      </Field>
      <Field label="Product Name">
        <Input value={form.productName} onChange={(e) => update("productName", e.target.value)} />
      </Field>
      <Field label="Quantity">
        <Input value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MetricCard({ title, value, suffix }: { title: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}{suffix ?? ""}</CardTitle>
      </CardHeader>
    </Card>
  );
}
