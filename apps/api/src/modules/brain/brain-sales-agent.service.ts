import { Injectable, NotFoundException } from "@nestjs/common";
import {
  MessageDirection,
  RevenueInfluenceType,
  SalesSuggestionStatus,
  SalesSuggestionType,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainAiService } from "./brain-ai.service";
import { BrainIntentService } from "./brain-intent.service";
import { BrainLeadScoreService } from "./brain-lead-score.service";
import { BrainRecommendationService } from "./brain-recommendation.service";
import { BrainSalesIntentService } from "./brain-sales-intent.service";
import { BrainSalesPlaybookService } from "./brain-sales-playbook.service";
import { AnalyzeSalesAgentDto } from "./dto/brain.dto";

@Injectable()
export class BrainSalesAgentService {
  constructor(
    private prisma: PrismaService,
    private intentService: BrainIntentService,
    private salesIntentService: BrainSalesIntentService,
    private leadScoreService: BrainLeadScoreService,
    private recommendationService: BrainRecommendationService,
    private playbookService: BrainSalesPlaybookService,
    private brainAiService: BrainAiService,
  ) {}

  async analyze(organizationId: string, dto: AnalyzeSalesAgentDto) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, organizationId, deletedAt: null },
      include: {
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
    const salesIntent = this.salesIntentService.detect(latestMessage, customerMessages);
    const playbook = await this.playbookService.get(organizationId);

    const [leadScore, recommendations, upsells, crossSells, brainResponse] = await Promise.all([
      this.leadScoreService.calculate({
        organizationId,
        customerId: conversation.customerId,
        conversationId: conversation.id,
        intent,
        customerMessageCount: customerMessages.length,
        priceQuestionCount: this.intentService.countPriceQuestions(customerMessages),
      }),
      this.recommendationService.recommendProducts(organizationId, latestMessage),
      this.recommendationService.upsellProducts(organizationId, latestMessage, []),
      this.recommendationService.crossSellProducts(organizationId, latestMessage, []),
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

    const upsellFromRecs = await this.recommendationService.upsellProducts(
      organizationId,
      latestMessage,
      recommendations,
    );
    const crossSellFromRecs = await this.recommendationService.crossSellProducts(
      organizationId,
      latestMessage,
      recommendations,
    );

    const objectionResponse = this.detectObjection(latestMessage)
      ? this.playbookService.getObjectionResponse(playbook, latestMessage)
      : null;

    const salesReply = this.buildSalesReply({
      salesIntent: salesIntent.intent,
      recommendations,
      brainResponse: brainResponse?.response,
      objectionResponse,
      playbook,
      latestMessage,
    });

    await this.prisma.salesSuggestion.deleteMany({
      where: {
        organizationId,
        conversationId: conversation.id,
        status: SalesSuggestionStatus.PENDING,
      },
    });

    const suggestionPayloads: Array<{
      type: SalesSuggestionType;
      title: string;
      content: string;
      reason: string;
      productId?: string;
    }> = [
      ...recommendations.map((item) => ({
        type: SalesSuggestionType.RECOMMENDATION,
        title: item.name,
        content: `${item.name} — ${item.price ?? "Price on request"} BDT. ${item.reason}`,
        reason: item.reason,
        productId: item.productId,
      })),
      ...upsellFromRecs.map((item) => ({
        type: SalesSuggestionType.UPSELL,
        title: item.name,
        content: `Upsell: ${item.name} — ${item.price ?? "Price on request"} BDT. ${item.reason}`,
        reason: item.reason,
        productId: item.productId,
      })),
      ...crossSellFromRecs.map((item) => ({
        type: SalesSuggestionType.CROSS_SELL,
        title: item.name,
        content: `Cross-sell: ${item.name} — ${item.price ?? "Price on request"} BDT. ${item.reason}`,
        reason: item.reason,
        productId: item.productId,
      })),
    ];

    if (objectionResponse) {
      suggestionPayloads.push({
        type: SalesSuggestionType.OBJECTION_RESPONSE,
        title: "Objection Handling",
        content: objectionResponse,
        reason: "Matched playbook objection rule",
      });
    }

    if (salesReply) {
      suggestionPayloads.push({
        type: SalesSuggestionType.SCRIPT,
        title: "Sales Reply",
        content: salesReply,
        reason: `Sales intent: ${salesIntent.label}`,
      });
    }

    const suggestions = await Promise.all(
      suggestionPayloads.slice(0, 8).map((payload) =>
        this.prisma.salesSuggestion.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            customerId: conversation.customerId,
            type: payload.type,
            salesIntent: salesIntent.intent,
            title: payload.title,
            content: payload.content,
            reason: payload.reason,
            ...(payload.productId ? { productId: payload.productId } : {}),
          },
        }),
      ),
    );

    if (recommendations.length) {
      await this.prisma.productMemory.updateMany({
        where: {
          organizationId,
          id: { in: recommendations.map((item) => item.productId) },
        },
        data: { recommendCount: { increment: 1 } },
      });
    }

    return {
      conversationId: conversation.id,
      customerId: conversation.customerId,
      latestMessage,
      intent,
      salesIntent,
      leadScore,
      recommendations,
      upsells: upsellFromRecs.length ? upsellFromRecs : upsells,
      crossSells: crossSellFromRecs.length ? crossSellFromRecs : crossSells,
      salesReply,
      objectionResponse,
      suggestions,
      playbookActive: playbook.isActive,
    };
  }

  async acceptSuggestion(organizationId: string, id: string) {
    const suggestion = await this.prisma.salesSuggestion.findFirst({
      where: { id, organizationId },
      include: { product: true },
    });
    if (!suggestion) throw new NotFoundException("Sales suggestion not found");

    const updated = await this.prisma.salesSuggestion.update({
      where: { id },
      data: {
        status: SalesSuggestionStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    if (suggestion.product?.salePrice ?? suggestion.product?.price) {
      const amount = suggestion.product.salePrice ?? suggestion.product.price ?? 0;
      await this.recordRevenueInfluence(organizationId, {
        type:
          suggestion.type === SalesSuggestionType.UPSELL
            ? RevenueInfluenceType.UPSELL
            : suggestion.type === SalesSuggestionType.CROSS_SELL
              ? RevenueInfluenceType.CROSS_SELL
              : RevenueInfluenceType.RECOMMENDATION,
        amount,
        conversationId: suggestion.conversationId ?? undefined,
        customerId: suggestion.customerId ?? undefined,
        productId: suggestion.productId ?? undefined,
        description: `Accepted ${suggestion.type} suggestion: ${suggestion.title}`,
      });

      await this.prisma.salesSuggestion.update({
        where: { id },
        data: { revenueInfluence: amount },
      });
    }

    return updated;
  }

  async dismissSuggestion(organizationId: string, id: string) {
    const suggestion = await this.prisma.salesSuggestion.findFirst({
      where: { id, organizationId },
    });
    if (!suggestion) throw new NotFoundException("Sales suggestion not found");

    return this.prisma.salesSuggestion.update({
      where: { id },
      data: { status: SalesSuggestionStatus.DISMISSED },
    });
  }

  async recordRevenueInfluence(
    organizationId: string,
    data: {
      type: RevenueInfluenceType | string;
      amount: number;
      conversationId?: string;
      customerId?: string;
      productId?: string;
      description?: string;
    },
  ) {
    return this.prisma.revenueInfluence.create({
      data: {
        organizationId,
        type: data.type as RevenueInfluenceType,
        amount: data.amount,
        conversationId: data.conversationId,
        customerId: data.customerId,
        productId: data.productId,
        description: data.description,
      },
    });
  }

  async getAnalytics(organizationId: string) {
    const [
      suggestions,
      revenueRecords,
      acceptedSuggestions,
      convertedSuggestions,
      leadScores,
    ] = await Promise.all([
      this.prisma.salesSuggestion.groupBy({
        by: ["type"],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prisma.revenueInfluence.aggregate({
        where: { organizationId },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.salesSuggestion.count({
        where: { organizationId, status: SalesSuggestionStatus.ACCEPTED },
      }),
      this.prisma.salesSuggestion.count({
        where: { organizationId, status: SalesSuggestionStatus.CONVERTED },
      }),
      this.prisma.leadScore.findMany({
        where: { organizationId },
        select: { score: true },
      }),
    ]);

    const totalSuggestions = suggestions.reduce((sum, item) => sum + item._count.id, 0);
    const avgLeadScore =
      leadScores.length > 0
        ? Math.round(leadScores.reduce((sum, item) => sum + item.score, 0) / leadScores.length)
        : 0;

    return {
      leadsGenerated: leadScores.filter((item) => item.score >= 60).length,
      ordersInfluenced: convertedSuggestions + acceptedSuggestions,
      revenueInfluenced: revenueRecords._sum.amount ?? 0,
      upsellsGenerated: suggestions.find((item) => item.type === SalesSuggestionType.UPSELL)?._count.id ?? 0,
      conversionRate:
        totalSuggestions > 0 ? Math.round((acceptedSuggestions / totalSuggestions) * 100) : 0,
      averageLeadScore: avgLeadScore,
      suggestionsByType: suggestions.map((item) => ({
        type: item.type,
        count: item._count.id,
      })),
    };
  }

  private buildSalesReply(input: {
    salesIntent: string;
    recommendations: Awaited<ReturnType<BrainRecommendationService["recommendProducts"]>>;
    brainResponse?: string | null;
    objectionResponse?: string | null;
    playbook: Awaited<ReturnType<BrainSalesPlaybookService["get"]>>;
    latestMessage: string;
  }) {
    const parts: string[] = [];

    if (input.brainResponse) parts.push(input.brainResponse);

    if (input.recommendations.length) {
      const top = input.recommendations[0];
      parts.push(
        `I recommend ${top.name}${top.price ? ` at ${top.price} BDT` : ""}. ${top.reason}.`,
      );
    }

    if (/deliver|delivery|courier|pathao/i.test(input.latestMessage)) {
      const script = this.playbookService.getScriptForTrigger(input.playbook, "delivery");
      if (script) parts.push(script);
    }

    if (/price|dam|koto|cost/i.test(input.latestMessage)) {
      const script = this.playbookService.getScriptForTrigger(input.playbook, "price_inquiry");
      if (script) parts.push(script);
    }

    if (input.objectionResponse) parts.push(input.objectionResponse);

    return parts.filter(Boolean).join(" ");
  }

  private detectObjection(message: string) {
    const patterns = [/expensive/i, /beshi/i, /delivery charge/i, /not sure/i, /confused/i, /doubt/i];
    return patterns.some((pattern) => pattern.test(message));
  }
}
