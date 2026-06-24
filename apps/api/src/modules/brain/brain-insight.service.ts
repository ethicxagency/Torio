import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";

@Injectable()
export class BrainInsightService {
  constructor(private prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    return this.prisma.customerInsight.findMany({
      where: { organizationId },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
      },
      orderBy: { totalRevenue: "desc" },
      take: 50,
    });
  }

  async getForCustomer(organizationId: string, customerId: string) {
    await this.assertCustomer(organizationId, customerId);

    const insight = await this.prisma.customerInsight.findUnique({
      where: { customerId },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
      },
    });

    if (insight) return insight;
    return this.refreshCustomerInsight(organizationId, customerId);
  }

  async refreshCustomerInsight(organizationId: string, customerId: string) {
    await this.assertCustomer(organizationId, customerId);

    const orders = await this.prisma.orderMemory.findMany({
      where: { organizationId, customerId, deletedAt: null },
      include: { items: true },
      orderBy: { orderDate: "desc" },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.orderValue, 0);
    const lastPurchaseAt = orders[0]?.orderDate ?? null;

    const productCounts = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        productCounts.set(item.productName, (productCounts.get(item.productName) ?? 0) + item.quantity);
      }
    }

    const favoriteProducts = [...productCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    let repeatPurchaseBehavior = "No purchases yet";
    if (totalOrders === 1) repeatPurchaseBehavior = "First-time buyer";
    else if (totalOrders >= 2 && totalOrders <= 3) repeatPurchaseBehavior = "Repeat buyer";
    else if (totalOrders > 3) repeatPurchaseBehavior = "Loyal repeat customer";

    return this.prisma.customerInsight.upsert({
      where: { customerId },
      update: {
        totalOrders,
        totalRevenue,
        lastPurchaseAt,
        favoriteProducts,
        repeatPurchaseBehavior,
        computedAt: new Date(),
      },
      create: {
        organizationId,
        customerId,
        totalOrders,
        totalRevenue,
        lastPurchaseAt,
        favoriteProducts,
        repeatPurchaseBehavior,
      },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, email: true } },
      },
    });
  }

  async refreshAllInsights(organizationId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
    });

    const insights = await Promise.all(
      customers.map((customer) => this.refreshCustomerInsight(organizationId, customer.id)),
    );

    return { refreshed: insights.length };
  }

  formatInsightForPrompt(
    insight: Awaited<ReturnType<BrainInsightService["getForCustomer"]>>,
  ): string {
    const customerName = insight.customer.fullName ?? insight.customer.phone ?? "Customer";
    return [
      `Customer: ${customerName}`,
      `Total Orders: ${insight.totalOrders}`,
      `Total Revenue: ${insight.totalRevenue}`,
      insight.lastPurchaseAt
        ? `Last Purchase: ${insight.lastPurchaseAt.toISOString().slice(0, 10)}`
        : null,
      insight.favoriteProducts.length
        ? `Favorite Products: ${insight.favoriteProducts.join(", ")}`
        : null,
      insight.repeatPurchaseBehavior
        ? `Purchase Behavior: ${insight.repeatPurchaseBehavior}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private async assertCustomer(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");
  }
}
