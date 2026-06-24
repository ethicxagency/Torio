import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { addDays } from "../../common/utils/crypto.util";

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) throw new NotFoundException("No active subscription");
    return subscription;
  }

  async changePlan(organizationId: string, planSlug: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { slug: planSlug, isActive: true },
    });

    if (!plan) throw new NotFoundException("Plan not found");

    const current = await this.getCurrent(organizationId);
    const now = new Date();

    return this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, 30),
      },
      include: { plan: true },
    });
  }
}
