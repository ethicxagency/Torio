"use client";

import { FormEvent, useState } from "react";
import { Package, Search, Truck } from "lucide-react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/config/branding";

interface ShipmentEvent {
  id: string;
  status: string;
  description: string;
  location: string | null;
  occurredAt: string;
}

interface Shipment {
  id: string;
  trackingNumber: string;
  orderNumber: string | null;
  status: string;
  courierStatus: string | null;
  provider: string;
  events: ShipmentEvent[];
}

interface PortalResult {
  organization: { name: string; slug: string };
  shipments: Shipment[];
  message?: string;
}

export default function TrackPage() {
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortalResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ organizationSlug });
      if (orderNumber) params.set("orderNumber", orderNumber);
      if (trackingNumber) params.set("trackingNumber", trackingNumber);

      const res = await fetch(`${API_URL}/portal/tracking?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Tracking lookup failed");
      setResult(data as PortalResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Track Your Order</h1>
          <p className="text-muted-foreground">
            Enter your order details to see live delivery status powered by {BRAND.name}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order lookup</CardTitle>
            <CardDescription>Provide your store slug and order or tracking number</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Store slug</Label>
                <Input
                  placeholder="your-store"
                  value={organizationSlug}
                  onChange={(e) => setOrganizationSlug(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Order number</Label>
                <Input
                  placeholder="12345"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking number</Label>
                <Input
                  placeholder="Consignment / tracking ID"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
                {loading ? "Searching..." : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Track order
                  </>
                )}
              </Button>
            </form>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Results for <span className="font-medium text-foreground">{result.organization.name}</span>
            </p>
            {result.shipments.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {result.message ?? "No shipment found for the provided details."}
                </CardContent>
              </Card>
            ) : (
              result.shipments.map((shipment) => (
                <Card key={shipment.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          {shipment.trackingNumber}
                        </CardTitle>
                        <CardDescription>
                          {shipment.orderNumber ? `Order #${shipment.orderNumber}` : "Shipment"} · {shipment.provider}
                        </CardDescription>
                      </div>
                      <Badge variant="success">{shipment.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {shipment.courierStatus && (
                      <p className="mb-4 text-sm text-muted-foreground">
                        Courier status: {shipment.courierStatus}
                      </p>
                    )}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Timeline</p>
                      {shipment.events.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No events yet.</p>
                      ) : (
                        shipment.events.map((event) => (
                          <div key={event.id} className="flex gap-3 border-l-2 border-primary/30 pl-4">
                            <div>
                              <p className="text-sm font-medium">{event.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(event.occurredAt).toLocaleString()}
                                {event.location ? ` · ${event.location}` : ""}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
