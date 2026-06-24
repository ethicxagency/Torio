import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CopilotAlertType,
  CopilotSuggestionStatus,
  CopilotSuggestionType,
  DetectedIntentType,
  MessageDirection,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainInsightService } from "./brain-insight.service";
import { BrainIntentService } from "./brain-intent.service";
import { BrainLeadScoreService } from "./brain-lead-score.service";
import { BrainOrderService } from "./brain-order.service";
import { BrainRecommendationService } from "./brain-recommendation.service";
import { BrainAiService } from "./brain-ai.service";
import { AnalyzeCopilotDto } from "./dto/brain.dto";

export interface CopilotAlert {
  type: CopilotAlertType;
  message: string;
  severity: "info" | "warning" | "critical";
}

@Injectable()
export class BrainCopilotService {
  constructor(
    private prisma: PrismaService,
    private intentService: BrainIntentService,
    private leadScoreService: BrainLeadScoreService,
    private recommendationService: BrainRecommendationService,
    private insightService: BrainInsightService,
    private orderService: BrainOrderService,
    private brainAiService: BrainAiService,
  ) {}

  async analyzeConversation(organizationId: string, dto: AnalyzeCopilotDto) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, organizationId, deletedAt: null },
      include: {
        channel: {
          select: {
            id: true,
            type: true,
            name: true,
            connection: {
              select: {
                pageName: true,
                instagramUsername: true,
                whatsappPhoneNumber: true,
              },
            },
          },
        },
        customer: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!conversation) throw new NotFoundException("Conversation not found");

    const customerMessages = conversation.messages
      .filter((message) => message.direction === MessageDirection.INBOUND)
      .map((message) => message.content);

    const latestMessage = dto.message ?? customerMessages[0] ?? "";
    const intent = this.intentService.detect(latestMessage, customerMessages);
    const priceQuestionCount = this.intentService.countPriceQuestions(customerMessages);

    const [leadScore, insight, orders, productRecommendations, brainTest] = await Promise.all([
      this.leadScoreService.calculate({
        organizationId,
        customerId: conversation.customerId,
        conversationId: conversation.id,
        intent,
        customerMessageCount: customerMessages.length,
        priceQuestionCount,
      }),
      this.insightService.getForCustomer(organizationId, conversation.customerId).catch(() => null),
      this.orderService.list(organizationId).then((items) =>
        items.filter((order) => order.customerId === conversation.customerId).slice(0, 5),
      ),
      this.recommendationService.recommendProducts(organizationId, latestMessage),
      latestMessage
        ? this.brainAiService
            .testResponse(
              organizationId,
              latestMessage,
              undefined,
              conversation.customerId,
              conversation.channelId,
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const upsellSuggestions = await this.recommendationService.upsellProducts(
      organizationId,
      latestMessage,
      productRecommendations,
    );
    const crossSellSuggestions = await this.recommendationService.crossSellProducts(
      organizationId,
      latestMessage,
      productRecommendations,
    );

    const alerts = this.buildAlerts({ intent, priceQuestionCount, latestMessage });
    const suggestedReplies = this.buildSuggestedReplies({
      intent,
      brainResponse: brainTest?.response,
      productRecommendations,
      orders,
    });

    await this.prisma.intentDetection.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        customerId: conversation.customerId,
        messageText: latestMessage,
        intent: intent.intent,
        confidence: intent.confidence,
        metadata: { signals: intent.signals },
      },
    });

    await this.prisma.copilotSuggestion.deleteMany({
      where: {
        organizationId,
        conversationId: conversation.id,
        status: CopilotSuggestionStatus.PENDING,
      },
    });

    const suggestionRecords = await this.persistSuggestions({
      organizationId,
      conversationId: conversation.id,
      customerId: conversation.customerId,
      suggestedReplies,
      productRecommendations,
      upsellSuggestions,
      crossSellSuggestions,
    });

    return {
      conversationId: conversation.id,
      customerId: conversation.customerId,
      customerName: conversation.customer.fullName ?? conversation.customer.phone,
      intent,
      leadScore,
      alerts,
      customerInsights: insight
        ? {
            totalOrders: insight.totalOrders,
            totalRevenue: insight.totalRevenue,
            lastPurchaseAt: insight.lastPurchaseAt,
            favoriteProducts: insight.favoriteProducts,
            repeatPurchaseBehavior: insight.repeatPurchaseBehavior,
          }
        : null,
      orderHistory: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        courier: order.courier,
        trackingNumber: order.trackingNumber,
        orderValue: order.orderValue,
        orderDate: order.orderDate,
        items: order.items,
      })),
      productRecommendations,
      upsells: upsellSuggestions,
      crossSells: crossSellSuggestions,
      suggestedReplies,
      suggestions: suggestionRecords,
      brainConfidence: brainTest
        ? { score: brainTest.confidenceScore, action: brainTest.action }
        : null,
    };
  }

  async acceptSuggestion(organizationId: string, suggestionId: string) {
    const suggestion = await this.prisma.copilotSuggestion.findFirst({
      where: { id: suggestionId, organizationId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found");

    const product = suggestion.productId
      ? await this.prisma.productMemory.findUnique({ where: { id: suggestion.productId } })
      : null;

    return this.prisma.copilotSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: CopilotSuggestionStatus.ACCEPTED,
        acceptedAt: new Date(),
        revenueInfluence: product?.salePrice ?? product?.price ?? suggestion.revenueInfluence ?? 0,
      },
    });
  }

  async dismissSuggestion(organizationId: string, suggestionId: string) {
    const suggestion = await this.prisma.copilotSuggestion.findFirst({
      where: { id: suggestionId, organizationId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found");

    return this.prisma.copilotSuggestion.update({
      where: { id: suggestionId },
      data: { status: CopilotSuggestionStatus.DISMISSED },
    });
  }

  async getAnalytics(organizationId: string) {
    const [productRecs, upsells, crossSells, accepted, revenueAgg, leadScores, conversions] =
      await Promise.all([
        this.prisma.copilotSuggestion.count({
          where: { organizationId, type: CopilotSuggestionType.PRODUCT },
        }),
        this.prisma.copilotSuggestion.count({
          where: { organizationId, type: CopilotSuggestionType.UPSELL },
        }),
        this.prisma.copilotSuggestion.count({
          where: { organizationId, type: CopilotSuggestionType.CROSS_SELL },
        }),
        this.prisma.copilotSuggestion.count({
          where: { organizationId, status: CopilotSuggestionStatus.ACCEPTED },
        }),
        this.prisma.copilotSuggestion.aggregate({
          where: { organizationId, status: CopilotSuggestionStatus.ACCEPTED },
          _sum: { revenueInfluence: true },
        }),
        this.prisma.leadScore.aggregate({
          where: { organizationId },
          _avg: { score: true },
          _count: true,
        }),
        this.prisma.leadScore.count({
          where: { organizationId, score: { gte: 70 } },
        }),
      ]);

    return {
      productRecommendations: productRecs,
      upsellRecommendations: upsells,
      crossSellRecommendations: crossSells,
      acceptedSuggestions: accepted,
      revenueInfluenced: revenueAgg._sum.revenueInfluence ?? 0,
      averageLeadScore: Math.round(leadScores._avg.score ?? 0),
      totalLeadsScored: leadScores._count,
      leadConversions: conversions,
    };
  }

  private buildAlerts(params: {
    intent: ReturnType<BrainIntentService["detect"]>;
    priceQuestionCount: number;
    latestMessage: string;
  }): CopilotAlert[] {
    const alerts: CopilotAlert[] = [];

    if (params.priceQuestionCount >= 3) {
      alerts.push({
        type: CopilotAlertType.REPEATED_PRICE_QUESTION,
        message: "Customer asked about price 3+ times — high purchase intent",
        severity: "warning",
      });
    }

    if (params.intent.intent === DetectedIntentType.HIGH_PURCHASE_INTENT) {
      alerts.push({
        type: CopilotAlertType.HIGH_PURCHASE_INTENT,
        message: "Strong buying signals detected",
        severity: "info",
      });
    }

    if (params.intent.intent === DetectedIntentType.WHOLESALE_INQUIRY) {
      alerts.push({
        type: CopilotAlertType.WHOLESALE_LEAD,
        message: "Customer requested wholesale pricing — wholesale lead",
        severity: "warning",
      });
    }

    const escalationKeywords = ["human", "agent", "মানুষ", "এজেন্ট"];
    if (escalationKeywords.some((keyword) => params.latestMessage.toLowerCase().includes(keyword))) {
      alerts.push({
        type: CopilotAlertType.ESCALATE,
        message: "Customer requested a human agent — escalate",
        severity: "critical",
      });
    }

    return alerts;
  }

  private buildSuggestedReplies(params: {
    intent: ReturnType<BrainIntentService["detect"]>;
    brainResponse?: string | null;
    productRecommendations: Awaited<
      ReturnType<BrainRecommendationService["recommendProducts"]>
    >;
    orders: Awaited<ReturnType<BrainOrderService["list"]>>;
  }) {
    const replies: Array<{ content: string; reason: string }> = [];

    if (params.brainResponse) {
      replies.push({ content: params.brainResponse, reason: "Torio Brain verified response" });
    }

    if (params.intent.intent === DetectedIntentType.ORDER_TRACKING && params.orders[0]) {
      const order = params.orders[0];
      replies.push({
        content: `Your order ${order.orderNumber} is ${order.status.replace(/_/g, " ").toLowerCase()}.${order.trackingNumber ? ` Tracking: ${order.trackingNumber} via ${order.courier ?? "courier"}.` : ""}`,
        reason: "Order Memory lookup",
      });
    }

    if (params.productRecommendations.length) {
      const top = params.productRecommendations[0];
      replies.push({
        content: `We have ${top.name}${top.price ? ` at ${top.price} BDT` : ""}. ${top.reason}.`,
        reason: "Product Memory recommendation",
      });
    }

    if (!replies.length) {
      replies.push({
        content: "Thanks for reaching out! Let me check the details and get back to you shortly.",
        reason: "Safe follow-up reply",
      });
    }

    return replies.slice(0, 3);
  }

  private async persistSuggestions(params: {
    organizationId: string;
    conversationId: string;
    customerId: string;
    suggestedReplies: Array<{ content: string; reason: string }>;
    productRecommendations: Awaited<
      ReturnType<BrainRecommendationService["recommendProducts"]>
    >;
    upsellSuggestions: Awaited<ReturnType<BrainRecommendationService["upsellProducts"]>>;
    crossSellSuggestions: Awaited<ReturnType<BrainRecommendationService["crossSellProducts"]>>;
  }) {
    const records = [
      ...params.suggestedReplies.map((reply) => ({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        type: CopilotSuggestionType.REPLY,
        title: "Suggested Reply",
        content: reply.content,
        reason: reply.reason,
      })),
      ...params.productRecommendations.map((product) => ({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        type: CopilotSuggestionType.PRODUCT,
        title: product.name,
        content: product.reason,
        reason: product.reason,
        productId: product.productId,
      })),
      ...params.upsellSuggestions.map((item) => ({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        type: CopilotSuggestionType.UPSELL,
        title: item.name,
        content: item.reason,
        reason: item.reason,
        productId: item.productId,
      })),
      ...params.crossSellSuggestions.map((item) => ({
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        type: CopilotSuggestionType.CROSS_SELL,
        title: item.name,
        content: item.reason,
        reason: item.reason,
        productId: item.productId,
      })),
      {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        type: CopilotSuggestionType.FOLLOW_UP,
        title: "Follow-Up",
        content: "Check back in 24 hours if the customer has not confirmed the order.",
        reason: "Maintain momentum after product discussion",
      },
    ];

    await this.prisma.copilotSuggestion.createMany({ data: records });
    return this.prisma.copilotSuggestion.findMany({
      where: {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        status: CopilotSuggestionStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
