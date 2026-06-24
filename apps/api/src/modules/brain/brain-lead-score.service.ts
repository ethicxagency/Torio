import { Injectable } from "@nestjs/common";
import { DetectedIntentType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { IntentResult } from "./brain-intent.service";

export interface LeadScoreResult {
  score: number;
  factors: {
    conversationActivity: number;
    productInterest: number;
    orderHistory: number;
    purchaseIntent: number;
  };
  summary: string;
}

@Injectable()
export class BrainLeadScoreService {
  constructor(private prisma: PrismaService) {}

  async calculate(params: {
    organizationId: string;
    customerId: string;
    conversationId?: string;
    intent: IntentResult;
    customerMessageCount: number;
    priceQuestionCount: number;
  }): Promise<LeadScoreResult> {
    const insight = await this.prisma.customerInsight.findUnique({
      where: { customerId: params.customerId },
    });

    const conversationActivity = Math.min(20, params.customerMessageCount * 3);
    const productInterest =
      params.intent.intent === DetectedIntentType.PRODUCT_INQUIRY ? 22 : 0;
    const orderHistory = insight
      ? Math.min(25, insight.totalOrders * 5 + Math.min(15, insight.totalRevenue / 500))
      : 0;
    const purchaseIntent = this.scorePurchaseIntent(params.intent, params.priceQuestionCount);

    const score = Math.min(
      100,
      Math.round(conversationActivity + productInterest + orderHistory + purchaseIntent),
    );

    const factors = {
      conversationActivity: Math.round(conversationActivity),
      productInterest: Math.round(productInterest),
      orderHistory: Math.round(orderHistory),
      purchaseIntent: Math.round(purchaseIntent),
    };

    const summary =
      score >= 80
        ? "Hot lead — strong purchase signals"
        : score >= 60
          ? "Warm lead — engaged and interested"
          : score >= 40
            ? "Developing lead — monitor closely"
            : "Cold lead — early stage conversation";

    await this.prisma.leadScore.upsert({
      where: { customerId: params.customerId },
      update: {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        score,
        factors,
      },
      create: {
        organizationId: params.organizationId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        score,
        factors,
      },
    });

    return { score, factors, summary };
  }

  private scorePurchaseIntent(intent: IntentResult, priceQuestionCount: number): number {
    let score = 0;
    if (intent.intent === DetectedIntentType.HIGH_PURCHASE_INTENT) score += 25;
    if (intent.intent === DetectedIntentType.WHOLESALE_INQUIRY) score += 20;
    if (priceQuestionCount >= 2) score += Math.min(15, priceQuestionCount * 4);
    return score;
  }
}
