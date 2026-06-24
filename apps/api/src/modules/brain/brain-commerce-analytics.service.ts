import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainSalesAgentService } from "./brain-sales-agent.service";
import { BrainCopilotService } from "./brain-copilot.service";

@Injectable()
export class BrainCommerceAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private salesAgentService: BrainSalesAgentService,
    private copilotService: BrainCopilotService,
  ) {}

  async getDashboard(organizationId: string) {
    const [
      topViewed,
      topRecommended,
      topSold,
      voiceCount,
      salesAnalytics,
      copilotAnalytics,
      revenueTotal,
      importJobs,
      syncSources,
    ] = await Promise.all([
      this.prisma.productMemory.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: { id: true, name: true, viewCount: true, price: true, salePrice: true, category: true },
      }),
      this.prisma.productMemory.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        orderBy: { recommendCount: "desc" },
        take: 5,
        select: { id: true, name: true, recommendCount: true, price: true, salePrice: true, category: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { organizationId, productId: { not: null } },
        _sum: { quantity: true },
        _count: { id: true },
      }),
      this.prisma.voiceTranscript.count({ where: { organizationId } }),
      this.salesAgentService.getAnalytics(organizationId),
      this.copilotService.getAnalytics(organizationId),
      this.prisma.revenueInfluence.aggregate({
        where: { organizationId },
        _sum: { amount: true },
      }),
      this.prisma.productImportJob.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { syncSource: { select: { name: true, type: true } } },
      }),
      this.prisma.productSyncSource.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          type: true,
          syncStatus: true,
          lastSyncAt: true,
          schedule: true,
          lastSyncError: true,
        },
      }),
    ]);

    const soldProductIds = topSold
      .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
      .slice(0, 5)
      .map((item) => item.productId)
      .filter(Boolean) as string[];

    const soldProducts = soldProductIds.length
      ? await this.prisma.productMemory.findMany({
          where: { organizationId, id: { in: soldProductIds } },
          select: { id: true, name: true, price: true, salePrice: true, category: true },
        })
      : [];

    const soldProductMap = new Map(soldProducts.map((item) => [item.id, item]));
    const topSoldSorted = topSold
      .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
      .slice(0, 5);

    return {
      mostViewedProducts: topViewed,
      mostRecommendedProducts: topRecommended,
      mostSoldProducts: topSoldSorted.map((item) => ({
        productId: item.productId,
        quantity: item._sum.quantity ?? 0,
        orderCount: item._count.id,
        product: item.productId ? soldProductMap.get(item.productId) ?? null : null,
      })),
      revenueInfluencedByAi: revenueTotal._sum.amount ?? 0,
      voiceMessagesProcessed: voiceCount,
      leadConversionRate: salesAnalytics.conversionRate,
      salesAnalytics,
      copilotAnalytics,
      catalogSync: {
        sources: syncSources,
        recentJobs: importJobs,
      },
    };
  }
}
