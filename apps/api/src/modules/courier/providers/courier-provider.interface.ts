import { CourierProviderType, ShipmentStatus } from "@prisma/client";

export interface CourierCredentials {
  [key: string]: string;
}

export interface CourierTestResult {
  success: boolean;
  message: string;
  accountName?: string;
}

export interface CourierTrackingEvent {
  status: ShipmentStatus;
  description: string;
  location?: string;
  occurredAt: Date;
}

export interface CourierTrackingResult {
  trackingNumber: string;
  status: ShipmentStatus;
  courierStatus: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  events: CourierTrackingEvent[];
}

export interface CourierProviderInterface {
  readonly provider: CourierProviderType;
  validateCredentials(credentials: CourierCredentials): CourierTestResult;
  testConnection(credentials: CourierCredentials): Promise<CourierTestResult>;
  fetchTracking(
    credentials: CourierCredentials,
    trackingNumber: string,
  ): Promise<CourierTrackingResult>;
  listShipments?(
    credentials: CourierCredentials,
    options?: { since?: Date; limit?: number },
  ): Promise<CourierTrackingResult[]>;
}
