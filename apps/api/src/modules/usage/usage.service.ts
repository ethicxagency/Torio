import { Injectable } from "@nestjs/common";
import { UsageMetric } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { startOfMonth, endOfMonth } from "../../common/utils/crypto.util";

@Injectable()
export class UsageService {
  constructor(private prisma: PrismaService) {}

  async increment(
    organizationId: string,
    metric: UsageMetric,
    amount = 1,
  ) {
    const periodStart = startOfMonth();
    const periodEnd = endOfMonth();

    return this.prisma.usageRecord.upsert({
      where: {
        organizationId_metric_periodStart: {
          organizationId,
          metric,
          periodStart,
        },
      },
      update: { value: { increment: amount } },
      create: { organizationId, metric, value: amount, periodStart, periodEnd },
    });
  }

  async getCurrentPeriod(organizationId: string) {
    const periodStart = startOfMonth();
    const records = await this.prisma.usageRecord.findMany({
      where: { organizationId, periodStart },
    });

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId, status: { in: ["ACTIVE", "TRIALING"] } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    const limits = subscription?.plan ?? null;

    return {
      periodStart,
      periodEnd: endOfMonth(),
      usage: records,
      limits: limits
        ? {
            maxMessages: limits.maxMessages,
            maxAiReplies: limits.maxAiReplies,
            maxStorageMb: limits.maxStorageMb,
            maxAgents: limits.maxAgents,
            maxChannels: limits.maxChannels,
          }
        : null,
    };
  }
}
