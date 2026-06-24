import { Injectable, NotFoundException } from "@nestjs/common";
import { OrderMemoryStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainKnowledgeSource } from "./brain-context.service";
import { BrainInsightService } from "./brain-insight.service";
import {
  CreateOrderMemoryDto,
  LookupOrdersDto,
  UpdateOrderMemoryDto,
} from "./dto/brain.dto";

const ORDER_INCLUDE = {
  customer: { select: { id: true, fullName: true, phone: true, email: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
};

export interface OrderLookupResult {
  order: Awaited<ReturnType<BrainOrderService["getById"]>>;
  score: number;
  matchedFields: string[];
}

const ORDER_INTENT_KEYWORDS = [
  "order",
  "tracking",
  "track",
  "delivery",
  "shipped",
  "courier",
  "status",
  "kothay",
  "amar",
  "parcel",
  "package",
  "deliver",
];

@Injectable()
export class BrainOrderService {
  constructor(
    private prisma: PrismaService,
    private insightService: BrainInsightService,
  ) {}

  async list(organizationId: string, options?: { limit?: number; offset?: number }) {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);

    return this.prisma.orderMemory.findMany({
      where: { organizationId, deletedAt: null },
      include: ORDER_INCLUDE,
      orderBy: [{ orderDate: "desc" }],
      take: limit,
      skip: offset,
    });
  }

  async getById(organizationId: string, id: string) {
    const order = await this.prisma.orderMemory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async create(organizationId: string, dto: CreateOrderMemoryDto) {
    await this.assertCustomer(organizationId, dto.customerId);

    const order = await this.prisma.orderMemory.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        orderNumber: dto.orderNumber,
        status: dto.status ?? OrderMemoryStatus.PENDING,
        courier: dto.courier,
        trackingNumber: dto.trackingNumber,
        paymentMethod: dto.paymentMethod,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
        orderValue: dto.orderValue ?? 0,
        items: dto.items?.length
          ? {
              create: dto.items.map((item) => ({
                organizationId,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice,
              })),
            }
          : undefined,
      },
      include: ORDER_INCLUDE,
    });

    await this.insightService.refreshCustomerInsight(organizationId, dto.customerId);
    return order;
  }

  async update(organizationId: string, id: string, dto: UpdateOrderMemoryDto) {
    const existing = await this.getById(organizationId, id);

    const order = await this.prisma.orderMemory.update({
      where: { id },
      data: {
        ...dto,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
      },
      include: ORDER_INCLUDE,
    });

    await this.insightService.refreshCustomerInsight(organizationId, existing.customerId);
    return order;
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.getById(organizationId, id);
    await this.prisma.orderMemory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.insightService.refreshCustomerInsight(organizationId, existing.customerId);
    return { success: true };
  }

  async lookup(organizationId: string, dto: LookupOrdersDto) {
    const orders = await this.prisma.orderMemory.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(dto.customerId ? { customerId: dto.customerId } : {}),
      },
      include: ORDER_INCLUDE,
      orderBy: { orderDate: "desc" },
      take: 100,
    });

    const query = dto.query.trim().toLowerCase();
    if (!query) {
      return orders.slice(0, dto.limit ?? 10).map((order) => ({
        order,
        score: 0,
        matchedFields: [],
      }));
    }

    return orders
      .map((order) => this.scoreOrder(query, order))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, dto.limit ?? 10);
  }

  async getRelevantOrders(
    organizationId: string,
    customerMessage: string,
    customerId?: string,
    limit = 5,
  ): Promise<BrainKnowledgeSource[]> {
    const hasOrderIntent = this.hasOrderIntent(customerMessage);
    const query = customerMessage.trim();

    if (customerId) {
      const customerOrders = await this.prisma.orderMemory.findMany({
        where: { organizationId, customerId, deletedAt: null },
        include: ORDER_INCLUDE,
        orderBy: { orderDate: "desc" },
        take: hasOrderIntent ? limit : 2,
      });

      if (customerOrders.length) {
        return customerOrders.map((order, index) => ({
          type: "order" as const,
          id: order.id,
          label: `Order ${order.orderNumber}`,
          content: this.formatOrderForPrompt(order),
          priority: 85 - index + (hasOrderIntent ? 10 : 0),
        }));
      }
    }

    if (!hasOrderIntent) return [];

    const results = await this.lookup(organizationId, { query, customerId, limit });
    return results.map(({ order, score, matchedFields }) => ({
      type: "order" as const,
      id: order.id,
      label: `Order ${order.orderNumber}`,
      content: this.formatOrderForPrompt(order, matchedFields),
      priority: 80 + Math.min(15, score),
    }));
  }

  formatOrderForPrompt(
    order: Awaited<ReturnType<BrainOrderService["getById"]>>,
    matchedFields: string[] = [],
  ): string {
    const customerName = order.customer.fullName ?? order.customer.phone ?? "Customer";
    const productLines = order.items
      .map(
        (item) =>
          `${item.productName} x${item.quantity}${item.unitPrice != null ? ` @ ${item.unitPrice}` : ""}`,
      )
      .join("; ");

    const lines = [
      `Order Number: ${order.orderNumber}`,
      `Customer: ${customerName}`,
      `Status: ${order.status.replace(/_/g, " ")}`,
      order.courier ? `Courier: ${order.courier}` : null,
      order.trackingNumber ? `Tracking Number: ${order.trackingNumber}` : null,
      order.paymentMethod ? `Payment Method: ${order.paymentMethod}` : null,
      `Order Date: ${order.orderDate.toISOString().slice(0, 10)}`,
      order.deliveryDate ? `Delivery Date: ${order.deliveryDate.toISOString().slice(0, 10)}` : null,
      `Order Value: ${order.orderValue}`,
      productLines ? `Products: ${productLines}` : null,
    ].filter(Boolean);

    if (matchedFields.length) {
      lines.push(`Matched on: ${matchedFields.join(", ")}`);
    }

    return lines.join("\n");
  }

  async getAnalytics(organizationId: string) {
    const [totalOrders, statusBreakdown, revenueAgg, recentOrders] = await Promise.all([
      this.prisma.orderMemory.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.orderMemory.groupBy({
        by: ["status"],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      this.prisma.orderMemory.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { orderValue: true },
        _avg: { orderValue: true },
      }),
      this.prisma.orderMemory.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          orderValue: true,
          orderDate: true,
          customer: { select: { fullName: true } },
        },
        orderBy: { orderDate: "desc" },
        take: 5,
      }),
    ]);

    return {
      totalOrders,
      totalRevenue: revenueAgg._sum.orderValue ?? 0,
      averageOrderValue: Math.round(revenueAgg._avg.orderValue ?? 0),
      statusBreakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: row._count,
      })),
      recentOrders,
    };
  }

  async trackUsage(orderIds: string[]) {
    await Promise.all(
      orderIds.map((id) =>
        this.prisma.orderMemory.update({
          where: { id },
          data: { usageCount: { increment: 1 } },
        }),
      ),
    );
  }

  private scoreOrder(
    query: string,
    order: Awaited<ReturnType<BrainOrderService["list"]>>[number],
  ): OrderLookupResult {
    const words = this.tokenize(query);
    const matchedFields = new Set<string>();
    let score = 0;

    const fields: Array<{ field: string; text: string; weight: number }> = [
      { field: "orderNumber", text: order.orderNumber, weight: 15 },
      { field: "trackingNumber", text: order.trackingNumber ?? "", weight: 14 },
      { field: "courier", text: order.courier ?? "", weight: 10 },
      { field: "status", text: order.status.replace(/_/g, " "), weight: 8 },
      { field: "paymentMethod", text: order.paymentMethod ?? "", weight: 6 },
      {
        field: "customer",
        text: `${order.customer.fullName ?? ""} ${order.customer.phone ?? ""}`,
        weight: 8,
      },
      {
        field: "products",
        text: order.items.map((i) => i.productName).join(" "),
        weight: 7,
      },
    ];

    for (const { field, text, weight } of fields) {
      const fieldScore = this.scoreText(words, text);
      if (fieldScore > 0) {
        score += fieldScore * weight;
        matchedFields.add(field);
      }
    }

    if (this.hasOrderIntent(query)) {
      score += 12;
      matchedFields.add("orderIntent");
    }

    if (query.includes(order.orderNumber.toLowerCase())) {
      score += 20;
      matchedFields.add("orderNumber");
    }

    if (order.trackingNumber && query.includes(order.trackingNumber.toLowerCase())) {
      score += 20;
      matchedFields.add("trackingNumber");
    }

    return {
      order,
      score: Math.round(score),
      matchedFields: Array.from(matchedFields),
    };
  }

  private hasOrderIntent(text: string): boolean {
    const normalized = text.toLowerCase();
    return ORDER_INTENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\s,./!?;:()\-]+/)
      .filter((w) => w.length > 1);
  }

  private scoreText(words: string[], text: string): number {
    const normalized = text.toLowerCase();
    if (!normalized || !words.length) return 0;

    let matches = 0;
    for (const word of words) {
      if (normalized.includes(word)) matches += 1;
    }
    return matches / words.length;
  }

  private async assertCustomer(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");
  }
}
