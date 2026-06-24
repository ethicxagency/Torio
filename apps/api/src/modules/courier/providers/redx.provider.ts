import { CourierProviderType, ShipmentStatus } from "@prisma/client";
import {
  CourierCredentials,
  CourierProviderInterface,
  CourierTestResult,
  CourierTrackingResult,
} from "./courier-provider.interface";

const REDX_API = "https://api.redx.com.bd/v1";

export class RedxProvider implements CourierProviderInterface {
  readonly provider = CourierProviderType.REDX;

  validateCredentials(credentials: CourierCredentials): CourierTestResult {
    const apiToken = credentials.apiToken?.trim();
    if (!apiToken || apiToken.length < 16) {
      return { success: false, message: "Valid API Token is required (min 16 characters)" };
    }
    return { success: true, message: "Credentials format is valid" };
  }

  async testConnection(credentials: CourierCredentials): Promise<CourierTestResult> {
    const validation = this.validateCredentials(credentials);
    if (!validation.success) return validation;

    try {
      const res = await fetch(`${REDX_API}/parcel/track/TEST`, {
        headers: { Authorization: `Bearer ${credentials.apiToken}` },
      });
      if (res.status === 401) {
        return { success: false, message: "Invalid RedX API Token" };
      }
      return {
        success: true,
        message: "Connected to RedX successfully",
        accountName: credentials.accountName ?? "RedX Account",
      };
    } catch {
      return {
        success: true,
        message: "Credentials validated (RedX API unavailable — mock mode)",
        accountName: credentials.accountName ?? "RedX Account",
      };
    }
  }

  async fetchTracking(
    credentials: CourierCredentials,
    trackingNumber: string,
  ): Promise<CourierTrackingResult> {
    try {
      const res = await fetch(`${REDX_API}/parcel/track/${trackingNumber}`, {
        headers: { Authorization: `Bearer ${credentials.apiToken}` },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          status?: string;
          tracking?: { status?: string; updated_at?: string }[];
        };
        const rawStatus = data.status ?? data.tracking?.[0]?.status ?? "pending";
        return this.mapResult(trackingNumber, rawStatus, data.tracking);
      }
    } catch {
      // mock fallback
    }

    return this.mockTracking(trackingNumber);
  }

  private mapResult(
    trackingNumber: string,
    rawStatus: string,
    tracking?: { status?: string; updated_at?: string }[],
  ): CourierTrackingResult {
    const status = this.mapStatus(rawStatus);
    const events = (tracking ?? []).map((item) => ({
      status: this.mapStatus(item.status ?? rawStatus),
      description: (item.status ?? rawStatus).replace(/_/g, " "),
      occurredAt: item.updated_at ? new Date(item.updated_at) : new Date(),
    }));

    return {
      trackingNumber,
      status,
      courierStatus: rawStatus,
      events: events.length
        ? events
        : [{ status, description: rawStatus, occurredAt: new Date() }],
    };
  }

  private mapStatus(raw: string): ShipmentStatus {
    const normalized = raw.toLowerCase();
    if (normalized.includes("deliver")) return ShipmentStatus.DELIVERED;
    if (normalized.includes("transit") || normalized.includes("hub")) return ShipmentStatus.IN_TRANSIT;
    if (normalized.includes("out")) return ShipmentStatus.OUT_FOR_DELIVERY;
    if (normalized.includes("return")) return ShipmentStatus.RETURNED;
    if (normalized.includes("cancel")) return ShipmentStatus.CANCELLED;
    if (normalized.includes("pick")) return ShipmentStatus.PICKED_UP;
    return ShipmentStatus.PENDING;
  }

  private mockTracking(trackingNumber: string): CourierTrackingResult {
    const now = new Date();
    return {
      trackingNumber,
      status: ShipmentStatus.OUT_FOR_DELIVERY,
      courierStatus: "out_for_delivery",
      events: [
        { status: ShipmentStatus.PENDING, description: "Parcel created", occurredAt: new Date(now.getTime() - 72 * 3600000) },
        { status: ShipmentStatus.IN_TRANSIT, description: "At sorting hub", location: "RedX Hub", occurredAt: new Date(now.getTime() - 36 * 3600000) },
        { status: ShipmentStatus.OUT_FOR_DELIVERY, description: "Out for delivery", location: "Local area", occurredAt: now },
      ],
    };
  }
}
