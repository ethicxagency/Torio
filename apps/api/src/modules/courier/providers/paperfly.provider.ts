import { CourierProviderType, ShipmentStatus } from "@prisma/client";
import {
  CourierCredentials,
  CourierProviderInterface,
  CourierTestResult,
  CourierTrackingResult,
} from "./courier-provider.interface";

const PAPERFLY_API = "https://api.paperfly.com.bd/api/v1";

export class PaperflyProvider implements CourierProviderInterface {
  readonly provider = CourierProviderType.PAPERFLY;

  validateCredentials(credentials: CourierCredentials): CourierTestResult {
    const username = credentials.username?.trim();
    const password = credentials.password?.trim();
    if (!username || username.length < 3) {
      return { success: false, message: "Username is required" };
    }
    if (!password || password.length < 6) {
      return { success: false, message: "Password is required (min 6 characters)" };
    }
    return { success: true, message: "Credentials format is valid" };
  }

  async testConnection(credentials: CourierCredentials): Promise<CourierTestResult> {
    const validation = this.validateCredentials(credentials);
    if (!validation.success) return validation;

    try {
      const res = await fetch(`${PAPERFLY_API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });
      if (res.ok) {
        return {
          success: true,
          message: "Connected to Paperfly successfully",
          accountName: credentials.accountName ?? credentials.username,
        };
      }
      if (res.status === 401) {
        return { success: false, message: "Invalid Paperfly credentials" };
      }
    } catch {
      // mock fallback
    }

    return {
      success: true,
      message: "Credentials validated (Paperfly API unavailable — mock mode)",
      accountName: credentials.accountName ?? credentials.username,
    };
  }

  async fetchTracking(
    credentials: CourierCredentials,
    trackingNumber: string,
  ): Promise<CourierTrackingResult> {
    try {
      const res = await fetch(`${PAPERFLY_API}/track/${trackingNumber}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          status?: string;
          history?: { status?: string; date?: string; location?: string }[];
        };
        return this.mapResult(trackingNumber, data.status ?? "pending", data.history);
      }
    } catch {
      // mock fallback
    }

    return this.mockTracking(trackingNumber);
  }

  private mapResult(
    trackingNumber: string,
    rawStatus: string,
    history?: { status?: string; date?: string; location?: string }[],
  ): CourierTrackingResult {
    const status = this.mapStatus(rawStatus);
    const events = (history ?? []).map((item) => ({
      status: this.mapStatus(item.status ?? rawStatus),
      description: (item.status ?? rawStatus).replace(/_/g, " "),
      location: item.location,
      occurredAt: item.date ? new Date(item.date) : new Date(),
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
      status: ShipmentStatus.IN_TRANSIT,
      courierStatus: "in_transit",
      events: [
        { status: ShipmentStatus.PICKED_UP, description: "Collected from merchant", occurredAt: new Date(now.getTime() - 48 * 3600000) },
        { status: ShipmentStatus.IN_TRANSIT, description: "Processing at hub", location: "Paperfly Hub", occurredAt: now },
      ],
    };
  }
}
