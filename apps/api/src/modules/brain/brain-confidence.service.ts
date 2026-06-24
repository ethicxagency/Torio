import { Injectable } from "@nestjs/common";
import { ConfidenceAction } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainKnowledgeSource } from "./brain-context.service";

export interface ConfidenceBreakdown {
  rulesScore: number;
  policyScore: number;
  orderScore: number;
  trackingScore: number;
  productScore: number;
  faqScore: number;
  memoryScore: number;
  knowledgeScore: number;
  totalScore: number;
  action: ConfidenceAction;
  reason: string;
}

export interface ConfidenceInput {
  question: string;
  rules: BrainKnowledgeSource[];
  customFields: BrainKnowledgeSource[];
  policies: BrainKnowledgeSource[];
  orders: BrainKnowledgeSource[];
  tracking: BrainKnowledgeSource[];
  products: BrainKnowledgeSource[];
  insights: BrainKnowledgeSource[];
  faqs: BrainKnowledgeSource[];
  memories: BrainKnowledgeSource[];
  entries: BrainKnowledgeSource[];
  documents: BrainKnowledgeSource[];
  knowledgeDocs: BrainKnowledgeSource[];
}

@Injectable()
export class BrainConfidenceService {
  constructor(private prisma: PrismaService) {}

  calculate(input: ConfidenceInput): ConfidenceBreakdown {
    const query = input.question.toLowerCase();
    const words = query.split(/\s+/).filter((w) => w.length > 2);

    const rulesScore = this.scoreSources(input.rules, words, 25);
    const customFieldScore = this.scoreSources(input.customFields, words, 22);
    const policyScore = this.scoreSources(input.policies, words, 24);
    const productScore = this.scoreSources(input.products, words, 20);
    const orderScore = this.scoreSources(input.orders, words, 18);
    const trackingScore = this.scoreSources(input.tracking, words, 22);
    const faqScore = this.scoreSources(input.faqs, words, 10);
    const memoryScore = this.scoreSources(
      [...input.memories, ...input.insights],
      words,
      10,
    );
    const knowledgeScore = this.scoreSources(
      [...input.entries, ...input.documents, ...input.knowledgeDocs],
      words,
      15,
    );

    const totalScore = Math.min(
      100,
      Math.round(
        rulesScore + customFieldScore + policyScore + orderScore + trackingScore + productScore + faqScore + memoryScore + knowledgeScore,
      ),
    );

    let action: ConfidenceAction;
    let reason: string;

    if (totalScore > 85) {
      action = ConfidenceAction.AUTO_REPLY;
      reason = "High confidence match across Torio Brain sources";
    } else if (totalScore >= 60) {
      action = ConfidenceAction.SUGGEST_REPLY;
      reason = "Moderate confidence — suggest reply for agent review";
    } else {
      action = ConfidenceAction.HUMAN_TAKEOVER;
      reason = "Low confidence — escalate to human agent";
    }

    if (input.rules.length && rulesScore >= 25) {
      action = ConfidenceAction.AUTO_REPLY;
      reason = "Business rule match overrides — must follow rule";
    } else if (input.customFields.length && customFieldScore >= 18) {
      action =
        totalScore > 85 ? ConfidenceAction.AUTO_REPLY : ConfidenceAction.SUGGEST_REPLY;
      reason = "Custom memory field match — answer from merchant-defined business memory";
    } else if (input.policies.length && policyScore >= 20) {
      action =
        totalScore > 85 ? ConfidenceAction.AUTO_REPLY : ConfidenceAction.SUGGEST_REPLY;
      reason = "Merchant policy match — answer from return/refund/exchange/cancellation policy";
    } else if (input.products.length && productScore >= 20) {
      action =
        totalScore > 85 ? ConfidenceAction.AUTO_REPLY : ConfidenceAction.SUGGEST_REPLY;
      reason = "Product memory match — answer from catalog only";
    } else if (input.tracking.length && trackingScore >= 20) {
      action =
        totalScore > 85 ? ConfidenceAction.AUTO_REPLY : ConfidenceAction.SUGGEST_REPLY;
      reason = "Live courier tracking match — answer from courier data";
    } else if (input.orders.length && orderScore >= 18) {
      action =
        totalScore > 85 ? ConfidenceAction.AUTO_REPLY : ConfidenceAction.SUGGEST_REPLY;
      reason = "Order memory match — answer from order history only";
    }

    return {
      rulesScore,
      policyScore,
      orderScore,
      trackingScore,
      productScore,
      faqScore,
      memoryScore,
      knowledgeScore,
      totalScore,
      action,
      reason,
    };
  }

  async log(params: {
    organizationId: string;
    conversationId?: string;
    customerId?: string;
    customerMessage: string;
    aiResponse?: string;
    breakdown: ConfidenceBreakdown;
    sourcesUsed: BrainKnowledgeSource[];
    isTest?: boolean;
  }) {
    return this.prisma.aiConfidenceLog.create({
      data: {
        organizationId: params.organizationId,
        conversationId: params.conversationId,
        customerId: params.customerId,
        customerMessage: params.customerMessage,
        aiResponse: params.aiResponse,
        confidenceScore: params.breakdown.totalScore,
        action: params.breakdown.action,
        reason: params.breakdown.reason,
        sourcesUsed: {
          breakdown: params.breakdown as unknown as Record<string, number | string>,
          sources: params.sourcesUsed.map((s) => ({
            type: s.type,
            id: s.id,
            label: s.label,
          })),
        },
        isTest: params.isTest ?? false,
      },
    });
  }

  async getAnalytics(organizationId: string) {
    const [logs, avgResult, pendingSuggestions, memoryCount] = await Promise.all([
      this.prisma.aiConfidenceLog.findMany({
        where: { organizationId, isTest: false },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { confidenceScore: true, createdAt: true, action: true },
      }),
      this.prisma.aiConfidenceLog.aggregate({
        where: { organizationId },
        _avg: { confidenceScore: true },
        _count: true,
      }),
      this.prisma.learningSuggestion.count({
        where: { organizationId, status: "PENDING" },
      }),
      this.prisma.customerMemory.count({
        where: { organizationId, deletedAt: null },
      }),
    ]);

    const trend = logs.reverse().map((l) => ({
      date: l.createdAt.toISOString().slice(0, 10),
      score: l.confidenceScore,
      action: l.action,
    }));

    return {
      averageConfidence: Math.round(avgResult._avg.confidenceScore ?? 0),
      totalEvaluations: avgResult._count,
      pendingSuggestions,
      totalMemories: memoryCount,
      confidenceTrend: trend,
    };
  }

  private scoreSources(sources: BrainKnowledgeSource[], words: string[], maxPoints: number): number {
    if (!sources.length || !words.length) return 0;

    const top = sources[0];
    const text = `${top.label} ${top.content}`.toLowerCase();
    const matches = words.filter((w) => text.includes(w)).length;
    const ratio = matches / words.length;

    return Math.min(maxPoints, Math.round(ratio * maxPoints + (sources.length > 0 ? maxPoints * 0.2 : 0)));
  }
}
