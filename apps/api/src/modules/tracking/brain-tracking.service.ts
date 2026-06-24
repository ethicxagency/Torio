import { Injectable } from "@nestjs/common";
import { ShipmentStatus, TrackingLanguage, TrackingResponseStyle } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainKnowledgeSource } from "../brain/brain-context.service";
import { DeliveryIntelligenceService } from "../delivery-intelligence/delivery-intelligence.service";
import { TrackingService } from "../tracking/tracking.service";
import { COURIER_PROVIDER_META } from "../courier/courier-provider.factory";

const TRACKING_INTENT_KEYWORDS = [
  "track",
  "tracking",
  "delivery",
  "courier",
  "shipment",
  "parcel",
  "kothay",
  "kobe",
  "pabe",
  "parcel ta",
  "order kothay",
  "delivery status",
  "shipping",
];

@Injectable()
export class BrainTrackingService {
  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
    private deliveryIntelligenceService: DeliveryIntelligenceService,
  ) {}

  hasTrackingIntent(message: string): boolean {
    const normalized = message.toLowerCase();
    return TRACKING_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  extractOrderIdentifiers(message: string): { orderNumber?: string; trackingNumber?: string } {
    const orderIdMatch = message.match(/order\s*(?:id|no|number)?\s*[#:]?\s*(\d{3,})/i);
    const bareNumberMatch = message.match(/\b(\d{4,})\b/);
    const trackingMatch = message.match(/(?:tracking|consignment|parcel)\s*(?:no|number|#)?\s*[:#]?\s*([A-Za-z0-9-]{6,})/i);

    return {
      orderNumber: orderIdMatch?.[1] ?? bareNumberMatch?.[1],
      trackingNumber: trackingMatch?.[1],
    };
  }

  async getRelevantTracking(
    organizationId: string,
    customerMessage: string,
    customerId?: string,
  ): Promise<BrainKnowledgeSource[]> {
    if (!this.hasTrackingIntent(customerMessage)) return [];

    const identifiers = this.extractOrderIdentifiers(customerMessage);
    const settings = await this.prisma.shippingDeliverySettings.findUnique({
      where: { organizationId },
    });

    let shipments: Awaited<ReturnType<TrackingService["lookup"]>>["shipments"] = [];

    if (identifiers.trackingNumber || identifiers.orderNumber) {
      const result = await this.trackingService.lookup(organizationId, {
        trackingNumber: identifiers.trackingNumber,
        orderNumber: identifiers.orderNumber,
      });
      shipments = result.shipments;
    }

    if (!shipments.length && customerId) {
      const orders = await this.prisma.orderMemory.findMany({
        where: { organizationId, customerId, deletedAt: null },
        orderBy: { orderDate: "desc" },
        take: 3,
      });

      for (const order of orders) {
        if (order.trackingNumber) {
          await this.trackingService.ensureShipmentFromOrder(organizationId, order.id);
        }
        const result = await this.trackingService.lookup(organizationId, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          trackingNumber: order.trackingNumber ?? undefined,
        });
        if (result.shipments.length) {
          shipments = [...shipments, ...result.shipments];
        }
      }
    }

    if (!shipments.length) return [];

    const intelligence = await this.deliveryIntelligenceService.get(organizationId);
    const intelligenceBlock = this.deliveryIntelligenceService.formatForPrompt(intelligence);

    return shipments.slice(0, 3).map((shipment, index) => ({
      type: "tracking" as const,
      id: shipment.id,
      label: `Tracking ${shipment.trackingNumber}`,
      content: this.formatShipmentForPrompt(
        shipment,
        settings?.responseStyle ?? TrackingResponseStyle.DETAILED,
        intelligenceBlock,
      ),
      priority: 88 - index,
    }));
  }

  formatShipmentForPrompt(
    shipment: {
      trackingNumber: string;
      status: ShipmentStatus;
      courierStatus: string | null;
      provider: string;
      orderNumber: string | null;
      estimatedDelivery: Date | null;
      deliveredAt: Date | null;
      recipientName: string | null;
      events: { description: string; location: string | null; occurredAt: Date; status: ShipmentStatus }[];
    },
    style: TrackingResponseStyle,
    intelligenceBlock?: string,
  ): string {
    const providerLabel =
      COURIER_PROVIDER_META[shipment.provider as keyof typeof COURIER_PROVIDER_META]?.label ??
      shipment.provider;

    const lines = [
      `Tracking Number: ${shipment.trackingNumber}`,
      shipment.orderNumber ? `Order Number: ${shipment.orderNumber}` : null,
      `Courier: ${providerLabel}`,
      `Status: ${shipment.status.replace(/_/g, " ")}`,
      shipment.courierStatus ? `Courier Status: ${shipment.courierStatus}` : null,
      shipment.estimatedDelivery
        ? `Estimated Delivery: ${shipment.estimatedDelivery.toISOString().slice(0, 10)}`
        : null,
      shipment.deliveredAt
        ? `Delivered At: ${shipment.deliveredAt.toISOString().slice(0, 10)}`
        : null,
      shipment.recipientName ? `Recipient: ${shipment.recipientName}` : null,
    ].filter(Boolean) as string[];

    if (style === TrackingResponseStyle.DETAILED && shipment.events.length) {
      lines.push("Timeline:");
      for (const event of shipment.events.slice(0, 5)) {
        const date = event.occurredAt.toISOString().slice(0, 16).replace("T", " ");
        lines.push(`- ${date}: ${event.description}${event.location ? ` (${event.location})` : ""}`);
      }
    }

    if (intelligenceBlock) {
      lines.push("", "Delivery Intelligence:", intelligenceBlock);
    }

    return lines.join("\n");
  }

  resolveLanguage(
    message: string,
    setting?: TrackingLanguage | null,
  ): "bn" | "en" {
    if (setting === TrackingLanguage.BANGLA) return "bn";
    if (setting === TrackingLanguage.ENGLISH) return "en";

    const banglaPattern = /[\u0980-\u09FF]/;
    if (banglaPattern.test(message)) return "bn";
    return "en";
  }

  buildTrackingResponse(
    trackingSource: BrainKnowledgeSource,
    language: "bn" | "en",
    style: TrackingResponseStyle,
  ): string {
    if (language === "bn") {
      return style === TrackingResponseStyle.SHORT
        ? `আপনার ডেলিভারি স্ট্যাটাস:\n${trackingSource.content.split("\n").slice(0, 4).join("\n")}`
        : `আপনার অর্ডার ট্র্যাকিং তথ্য:\n${trackingSource.content}`;
    }

    return style === TrackingResponseStyle.SHORT
      ? `Delivery status:\n${trackingSource.content.split("\n").slice(0, 4).join("\n")}`
      : `Your tracking information:\n${trackingSource.content}`;
  }
}
