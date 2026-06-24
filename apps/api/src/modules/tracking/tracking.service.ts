import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CourierConnectionStatus,
  OrderMemoryStatus,
  Prisma,
  ShipmentStatus,
  TrackingSyncInterval,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { CourierService } from "../courier/courier.service";
import { getCourierProvider } from "../courier/courier-provider.factory";
import { SyncTrackingDto, TrackingLookupQueryDto } from "../courier/dto/courier.dto";

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private courierService: CourierService,
  ) {}

  async lookup(organizationId: string, query: TrackingLookupQueryDto) {
    const where: Record<string, unknown> = { organizationId };

    if (query.orderId) {
      where.orderId = query.orderId;
    } else if (query.orderNumber) {
      where.orderNumber = query.orderNumber;
    } else if (query.trackingNumber) {
      where.trackingNumber = query.trackingNumber;
    } else {
      return { shipments: [], message: "Provide orderId, orderNumber, or trackingNumber" };
    }

    const shipments = await this.prisma.shipment.findMany({
      where,
      include: {
        events: { orderBy: { occurredAt: "desc" } },
        courierConnection: { select: { provider: true, accountName: true, status: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customer: { select: { fullName: true, phone: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    await this.logTracking(organizationId, {
      action: "lookup",
      source: "api",
      orderId: query.orderId,
      orderNumber: query.orderNumber,
      trackingNumber: query.trackingNumber,
      status: shipments[0]?.status,
      shipmentId: shipments[0]?.id,
    });

    return { shipments };
  }

  async getByOrderId(organizationId: string, orderId: string) {
    return this.lookup(organizationId, { orderId });
  }

  async getTimeline(organizationId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId },
      include: {
        events: { orderBy: { occurredAt: "desc" } },
        courierConnection: { select: { provider: true, accountName: true } },
      },
    });
    if (!shipment) throw new NotFoundException("Shipment not found");
    return { shipment, timeline: shipment.events };
  }

  async sync(organizationId: string, dto: SyncTrackingDto = {}) {
    if (dto.shipmentId) {
      const result = await this.syncShipment(organizationId, dto.shipmentId);
      return { synced: 1, results: [result] };
    }

    const shipments = await this.prisma.shipment.findMany({
      where: {
        organizationId,
        ...(dto.orderId ? { orderId: dto.orderId } : {}),
      },
      take: 100,
    });

    const results = [];
    for (const shipment of shipments) {
      results.push(await this.syncShipment(organizationId, shipment.id));
    }

    return { synced: results.length, results };
  }

  async syncShipment(organizationId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId },
      include: { courierConnection: true },
    });
    if (!shipment) throw new NotFoundException("Shipment not found");
    if (!shipment.courierConnection || shipment.courierConnection.status !== CourierConnectionStatus.CONNECTED) {
      return { shipmentId, success: false, message: "No active courier connection" };
    }

    const credentials = this.courierService.decryptCredentials(shipment.courierConnection.credentialsEnc);
    const provider = getCourierProvider(shipment.provider);
    const tracking = await provider.fetchTracking(credentials, shipment.trackingNumber);

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: tracking.status,
        courierStatus: tracking.courierStatus,
        recipientName: tracking.recipientName,
        recipientPhone: tracking.recipientPhone,
        recipientAddress: tracking.recipientAddress,
        estimatedDelivery: tracking.estimatedDelivery,
        deliveredAt: tracking.deliveredAt,
        lastSyncedAt: new Date(),
      },
    });

    for (const event of tracking.events) {
      const existing = await this.prisma.shipmentEvent.findFirst({
        where: {
          shipmentId,
          description: event.description,
          occurredAt: event.occurredAt,
        },
      });
      if (!existing) {
        await this.prisma.shipmentEvent.create({
          data: {
            organizationId,
            shipmentId,
            status: event.status,
            description: event.description,
            location: event.location,
            occurredAt: event.occurredAt,
            source: "courier",
          },
        });
      }
    }

    if (shipment.orderId) {
      await this.updateOrderMemory(organizationId, shipment.orderId, tracking.status);
    }

    await this.prisma.courierConnection.update({
      where: { id: shipment.courierConnectionId! },
      data: { lastSyncAt: new Date() },
    });

    await this.logTracking(organizationId, {
      action: "sync",
      source: "api",
      shipmentId,
      orderId: shipment.orderId ?? undefined,
      orderNumber: shipment.orderNumber ?? undefined,
      trackingNumber: shipment.trackingNumber,
      status: updated.status,
    });

    return { shipmentId, success: true, status: updated.status };
  }

  async syncOrganization(organizationId: string) {
    const shipments = await this.prisma.shipment.findMany({
      where: { organizationId },
      select: { id: true },
      take: 200,
    });

    let synced = 0;
    for (const { id } of shipments) {
      const result = await this.syncShipment(organizationId, id);
      if (result.success) synced += 1;
    }

    return { organizationId, synced, total: shipments.length };
  }

  async ensureShipmentFromOrder(organizationId: string, orderId: string) {
    const order = await this.prisma.orderMemory.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
    });
    if (!order?.trackingNumber || !order.courier) return null;

    const provider = this.resolveProvider(order.courier);
    if (!provider) return null;

    const connection = await this.prisma.courierConnection.findFirst({
      where: {
        organizationId,
        provider,
        deletedAt: null,
        status: CourierConnectionStatus.CONNECTED,
      },
    });

    return this.prisma.shipment.upsert({
      where: {
        organizationId_trackingNumber_provider: {
          organizationId,
          trackingNumber: order.trackingNumber,
          provider,
        },
      },
      create: {
        organizationId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        courierConnectionId: connection?.id,
        provider,
        trackingNumber: order.trackingNumber,
        status: ShipmentStatus.PENDING,
      },
      update: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        courierConnectionId: connection?.id,
      },
    });
  }

  async portalLookup(
    organizationSlug: string,
    query: { orderId?: string; orderNumber?: string; trackingNumber?: string },
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { slug: organizationSlug, deletedAt: null },
      include: { shippingDeliverySettings: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    if (org.shippingDeliverySettings && !org.shippingDeliverySettings.portalEnabled) {
      throw new NotFoundException("Tracking portal is disabled");
    }

    const result = await this.lookup(org.id, query);

    await this.logTracking(org.id, {
      action: "portal_lookup",
      source: "portal",
      orderId: query.orderId,
      orderNumber: query.orderNumber,
      trackingNumber: query.trackingNumber,
      status: result.shipments[0]?.status,
      shipmentId: result.shipments[0]?.id,
    });

    return {
      organization: { name: org.name, slug: org.slug },
      ...result,
    };
  }

  async getAnalytics(organizationId: string) {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const [trackingRequests, courierStatusRequests, aiResolved, humanEscalations] =
      await Promise.all([
        this.prisma.trackingLog.count({
          where: { organizationId, action: { in: ["lookup", "portal_lookup"] }, createdAt: { gte: periodStart } },
        }),
        this.prisma.trackingLog.count({
          where: { organizationId, action: "sync", createdAt: { gte: periodStart } },
        }),
        this.prisma.trackingLog.count({
          where: { organizationId, action: "ai_tracking_resolved", createdAt: { gte: periodStart } },
        }),
        this.prisma.trackingLog.count({
          where: { organizationId, action: "ai_tracking_escalated", createdAt: { gte: periodStart } },
        }),
      ]);

    return {
      periodStart,
      trackingRequests,
      courierStatusRequests,
      aiResolvedTrackingQuestions: aiResolved,
      humanEscalations,
    };
  }

  getSyncIntervalMs(interval: TrackingSyncInterval): number {
    return interval === TrackingSyncInterval.ONE_HOUR ? 60 * 60 * 1000 : 30 * 60 * 1000;
  }

  private async updateOrderMemory(organizationId: string, orderId: string, status: ShipmentStatus) {
    const orderStatus = this.mapShipmentToOrderStatus(status);
    await this.prisma.orderMemory.updateMany({
      where: { id: orderId, organizationId },
      data: {
        status: orderStatus,
        ...(status === ShipmentStatus.DELIVERED ? { deliveryDate: new Date() } : {}),
      },
    });
  }

  private mapShipmentToOrderStatus(status: ShipmentStatus): OrderMemoryStatus {
    switch (status) {
      case ShipmentStatus.DELIVERED:
        return OrderMemoryStatus.DELIVERED;
      case ShipmentStatus.OUT_FOR_DELIVERY:
        return OrderMemoryStatus.OUT_FOR_DELIVERY;
      case ShipmentStatus.IN_TRANSIT:
      case ShipmentStatus.PICKED_UP:
        return OrderMemoryStatus.SHIPPED;
      case ShipmentStatus.CANCELLED:
        return OrderMemoryStatus.CANCELLED;
      case ShipmentStatus.RETURNED:
        return OrderMemoryStatus.RETURNED;
      default:
        return OrderMemoryStatus.PROCESSING;
    }
  }

  private resolveProvider(courierName: string) {
    const normalized = courierName.toLowerCase();
    if (normalized.includes("stead")) return "STEADFAST" as const;
    if (normalized.includes("redx")) return "REDX" as const;
    if (normalized.includes("paper")) return "PAPERFLY" as const;
    if (normalized.includes("pathao")) return "PATHAO" as const;
    return null;
  }

  async logTracking(
    organizationId: string,
    data: {
      action: string;
      source?: string;
      shipmentId?: string;
      orderId?: string;
      orderNumber?: string;
      trackingNumber?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.prisma.trackingLog.create({
      data: {
        organizationId,
        shipmentId: data.shipmentId,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        trackingNumber: data.trackingNumber,
        action: data.action,
        source: data.source,
        status: data.status,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
