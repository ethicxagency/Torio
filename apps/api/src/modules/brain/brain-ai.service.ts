import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfidenceAction, TrackingResponseStyle } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainContextService, BrainKnowledgeSource } from "./brain-context.service";
import { BrainService } from "./brain.service";
import { BrainConfidenceService } from "./brain-confidence.service";
import { BrainProductService } from "./brain-product.service";
import { BrainOrderService } from "./brain-order.service";
import { BrainTrackingService } from "../tracking/brain-tracking.service";
import { TrackingService } from "../tracking/tracking.service";

export interface BrainTestResult {
  response: string;
  confidence: number;
  confidenceScore: number;
  action: ConfidenceAction;
  sources: BrainKnowledgeSource[];
  rulesUsed: BrainKnowledgeSource[];
  policiesUsed: BrainKnowledgeSource[];
  ordersUsed: BrainKnowledgeSource[];
  productsUsed: BrainKnowledgeSource[];
  memoriesUsed: BrainKnowledgeSource[];
  knowledgeUsed: BrainKnowledgeSource[];
  breakdown: {
    rulesScore: number;
    policyScore: number;
    orderScore: number;
    trackingScore: number;
    productScore: number;
    faqScore: number;
    memoryScore: number;
    knowledgeScore: number;
  };
  language: string;
  escalated: boolean;
  escalationReason?: string;
  model: string;
}

@Injectable()
export class BrainAiService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private brainService: BrainService,
    private contextService: BrainContextService,
    private confidenceService: BrainConfidenceService,
    private productService: BrainProductService,
    private orderService: BrainOrderService,
    private trackingBrainService: BrainTrackingService,
    private trackingService: TrackingService,
  ) {}

  async testResponse(
    organizationId: string,
    question: string,
    language?: string,
    customerId?: string,
    channelId?: string,
  ) {
    await this.brainService.ensureInitialized(organizationId);

    const settings = await this.prisma.brainSettings.findUniqueOrThrow({
      where: { organizationId },
    });
    const shippingSettings = await this.prisma.shippingDeliverySettings.findUnique({
      where: { organizationId },
    });

    if (!settings.isEnabled) {
      throw new BadRequestException("Torio Brain is disabled for this organization");
    }

    const detectedLanguage =
      language ??
      this.trackingBrainService.resolveLanguage(question, shippingSettings?.language);

    const context = await this.contextService.buildContext(
      organizationId,
      question,
      customerId,
      channelId,
    );

    const breakdown = this.confidenceService.calculate({
      question,
      rules: context.rules,
      customFields: context.customFields,
      policies: context.policies,
      orders: context.orders,
      tracking: context.tracking,
      products: context.products,
      insights: context.insights,
      faqs: context.faqs,
      memories: context.memories,
      entries: context.entries,
      documents: context.documents,
      knowledgeDocs: context.knowledgeDocs,
    });

    const allSources = this.collectSources(context);
    const rulesUsed = context.rules.slice(0, 5);
    const policiesUsed = context.policies.slice(0, 5);
    const ordersUsed = context.orders.slice(0, 5);
    const productsUsed = context.products.slice(0, 5);
    const memoriesUsed = [...context.memories, ...context.insights].slice(0, 5);
    const knowledgeUsed = [
      ...context.faqs,
      ...context.entries,
      ...context.documents,
      ...context.knowledgeDocs,
    ].slice(0, 8);

    if (this.shouldEscalate(question, settings.escalationKeywords)) {
      const result = this.buildResult({
        response: this.escalationMessage(detectedLanguage),
        confidenceScore: 100,
        action: ConfidenceAction.HUMAN_TAKEOVER,
        sources: rulesUsed,
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
        breakdown,
        language: detectedLanguage,
        escalated: true,
        escalationReason: "Customer requested human agent",
        model: "brain-escalation",
      });
      await this.confidenceService.log({
        organizationId,
        customerId,
        customerMessage: question,
        aiResponse: result.response,
        breakdown,
        sourcesUsed: allSources,
        isTest: true,
      });
      return result;
    }

    let result: BrainTestResult;

    const openAiKey = this.config.get<string>("OPENAI_API_KEY");
    if (openAiKey && allSources.length > 0 && breakdown.action !== ConfidenceAction.HUMAN_TAKEOVER) {
      result = await this.generateWithOpenAi(
        openAiKey,
        question,
        context,
        detectedLanguage,
        breakdown,
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
      );
    } else {
      result = this.generateFromBrainOnly(
        question,
        context,
        detectedLanguage,
        breakdown,
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
        shippingSettings?.responseStyle ?? TrackingResponseStyle.DETAILED,
      );
    }

    await this.trackSourceUsage(allSources.slice(0, 8));
    await this.confidenceService.log({
      organizationId,
      customerId,
      customerMessage: question,
      aiResponse: result.response,
      breakdown,
      sourcesUsed: allSources,
      isTest: true,
    });

    if (context.tracking.length) {
      await this.trackingService.logTracking(organizationId, {
        action: result.escalated ? "ai_tracking_escalated" : "ai_tracking_resolved",
        source: "ai",
        shipmentId: context.tracking[0]?.id,
        metadata: { question, language: detectedLanguage },
      });
    }

    return result;
  }

  private async generateWithOpenAi(
    apiKey: string,
    question: string,
    context: Awaited<ReturnType<BrainContextService["buildContext"]>>,
    language: string,
    breakdown: ReturnType<BrainConfidenceService["calculate"]>,
    rulesUsed: BrainKnowledgeSource[],
    policiesUsed: BrainKnowledgeSource[],
    ordersUsed: BrainKnowledgeSource[],
    productsUsed: BrainKnowledgeSource[],
    memoriesUsed: BrainKnowledgeSource[],
    knowledgeUsed: BrainKnowledgeSource[],
  ): Promise<BrainTestResult> {
    const knowledgeBlock = this.contextService.formatContextForPrompt(context);

    if (!knowledgeBlock.trim()) {
      return this.buildResult({
        response: this.noKnowledgeMessage(language),
        confidenceScore: 0,
        action: ConfidenceAction.HUMAN_TAKEOVER,
        sources: [],
        rulesUsed: [],
        policiesUsed: [],
        ordersUsed: [],
        productsUsed: [],
        memoriesUsed: [],
        knowledgeUsed: [],
        breakdown,
        language,
        escalated: true,
        escalationReason: "No Torio Brain knowledge available",
        model: "brain-empty",
      });
    }

    const model = this.config.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";
    const userPrompt = [
      knowledgeBlock,
      "",
      `Customer question: ${question}`,
      `Respond in ${language === "bn" ? "Bangla" : "English"}.`,
    ].join("\n");

    const started = Date.now();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: context.systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`OpenAI error: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const response = data.choices?.[0]?.message?.content?.trim() ?? this.noKnowledgeMessage(language);

    return this.buildResult({
      response,
      confidenceScore: breakdown.totalScore,
      action: breakdown.action,
      sources: this.collectSources(context).slice(0, 8),
      rulesUsed,
      policiesUsed,
      ordersUsed,
      productsUsed,
      memoriesUsed,
      knowledgeUsed,
      breakdown,
      language,
      escalated: breakdown.action === ConfidenceAction.HUMAN_TAKEOVER,
      escalationReason:
        breakdown.action === ConfidenceAction.HUMAN_TAKEOVER ? breakdown.reason : undefined,
      model: `${model} (${Date.now() - started}ms)`,
    });
  }

  private generateFromBrainOnly(
    question: string,
    context: Awaited<ReturnType<BrainContextService["buildContext"]>>,
    language: string,
    breakdown: ReturnType<BrainConfidenceService["calculate"]>,
    rulesUsed: BrainKnowledgeSource[],
    policiesUsed: BrainKnowledgeSource[],
    ordersUsed: BrainKnowledgeSource[],
    productsUsed: BrainKnowledgeSource[],
    memoriesUsed: BrainKnowledgeSource[],
    knowledgeUsed: BrainKnowledgeSource[],
    trackingResponseStyle: TrackingResponseStyle = TrackingResponseStyle.DETAILED,
  ): BrainTestResult {
    const query = question.toLowerCase();

    if (context.tracking.length && breakdown.trackingScore >= 18) {
      const topTracking = context.tracking[0];
      const response = this.trackingBrainService.buildTrackingResponse(
        topTracking,
        language as "bn" | "en",
        trackingResponseStyle,
      );

      return this.buildResult({
        response,
        confidenceScore: Math.max(breakdown.totalScore, 92),
        action: ConfidenceAction.AUTO_REPLY,
        sources: [topTracking],
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
        breakdown,
        language,
        escalated: false,
        model: "brain-tracking-match",
      });
    }

    if (context.orders.length && breakdown.orderScore >= 15) {
      const topOrder = context.orders[0];
      const response =
        language === "bn"
          ? `আপনার অর্ডার তথ্য:\n${topOrder.content}`
          : `Your order details:\n${topOrder.content}`;

      return this.buildResult({
        response,
        confidenceScore: Math.max(breakdown.totalScore, 90),
        action: ConfidenceAction.AUTO_REPLY,
        sources: [topOrder],
        rulesUsed,
        policiesUsed,
        ordersUsed: [topOrder],
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
        breakdown,
        language,
        escalated: false,
        model: "brain-order-match",
      });
    }

    if (context.products.length && breakdown.productScore >= 15) {
      const topProduct = context.products[0];
      const response =
        language === "bn"
          ? `আমাদের পণ্য তথ্য অনুযায়ী:\n${topProduct.content}`
          : `Based on our product catalog:\n${topProduct.content}`;

      return this.buildResult({
        response,
        confidenceScore: Math.max(breakdown.totalScore, 88),
        action: ConfidenceAction.AUTO_REPLY,
        sources: [topProduct],
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed: [topProduct],
        memoriesUsed,
        knowledgeUsed,
        breakdown,
        language,
        escalated: false,
        model: "brain-product-match",
      });
    }

    if (context.policies.length && breakdown.policyScore >= 18) {
      const topPolicy = context.policies[0];
      const response =
        language === "bn"
          ? `আমাদের নীতিমালা অনুযায়ী:\n${topPolicy.content}`
          : `According to our policy:\n${topPolicy.content}`;

      return this.buildResult({
        response,
        confidenceScore: Math.max(breakdown.totalScore, 90),
        action: ConfidenceAction.AUTO_REPLY,
        sources: [topPolicy],
        rulesUsed,
        policiesUsed: [topPolicy],
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
        breakdown,
        language,
        escalated: false,
        model: "brain-policy-match",
      });
    }

    const matchingFaq = context.faqs.find((f) =>
      f.label.toLowerCase().split(/\s+/).some((w) => w.length > 3 && query.includes(w)),
    );

    if (matchingFaq) {
      return this.buildResult({
        response: matchingFaq.content,
        confidenceScore: Math.max(breakdown.totalScore, 92),
        action: ConfidenceAction.AUTO_REPLY,
        sources: [matchingFaq],
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed: [matchingFaq, ...knowledgeUsed.slice(0, 3)],
        breakdown,
        language,
        escalated: false,
        model: "brain-faq-match",
      });
    }

    if (context.rules.length && breakdown.rulesScore >= 20) {
      const topRule = context.rules[0];
      return this.buildResult({
        response:
          language === "bn"
            ? `আমাদের নীতিমালা অনুযায়ী: ${topRule.content}`
            : `According to our business rules: ${topRule.content}`,
        confidenceScore: Math.max(breakdown.totalScore, 90),
        action: ConfidenceAction.AUTO_REPLY,
        sources: [topRule],
        rulesUsed: [topRule],
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed,
        breakdown,
        language,
        escalated: false,
        model: "brain-rule-match",
      });
    }

    const relevantEntries = context.entries.filter((e) => e.priority > 60);
    if (relevantEntries.length) {
      const top = relevantEntries.slice(0, 3);
      const response =
        language === "bn"
          ? `আমাদের তথ্য অনুযায়ী:\n${top.map((e) => `• ${e.label}: ${e.content}`).join("\n")}`
          : `Based on our business information:\n${top.map((e) => `• ${e.label}: ${e.content}`).join("\n")}`;

      return this.buildResult({
        response,
        confidenceScore: breakdown.totalScore,
        action: breakdown.action,
        sources: top,
        rulesUsed,
        policiesUsed,
        ordersUsed,
        productsUsed,
        memoriesUsed,
        knowledgeUsed: [...top, ...knowledgeUsed.slice(0, 3)],
        breakdown,
        language,
        escalated: breakdown.action === ConfidenceAction.HUMAN_TAKEOVER,
        escalationReason:
          breakdown.action === ConfidenceAction.HUMAN_TAKEOVER ? breakdown.reason : undefined,
        model: "brain-entry-match",
      });
    }

    return this.buildResult({
      response:
        breakdown.action === ConfidenceAction.HUMAN_TAKEOVER
          ? language === "bn"
            ? "আপনার প্রশ্নের সঠিক উত্তর Torio Brain-এ পাওয়া যায়নি। একজন এজেন্টের সাথে সংযুক্ত করছি।"
            : "I couldn't find a precise answer in Torio Brain. Let me connect you with a human agent."
          : this.noKnowledgeMessage(language),
      confidenceScore: breakdown.totalScore,
      action: breakdown.action,
      sources: allSourcesSlice(context),
      rulesUsed,
      policiesUsed,
      ordersUsed,
      productsUsed,
      memoriesUsed,
      knowledgeUsed,
      breakdown,
      language,
      escalated: breakdown.action !== ConfidenceAction.AUTO_REPLY,
      escalationReason: breakdown.reason,
      model: "brain-fallback",
    });
  }

  private collectSources(context: Awaited<ReturnType<BrainContextService["buildContext"]>>) {
    return [
      ...context.rules,
      ...context.customFields,
      ...context.policies,
      ...context.products,
      ...context.orders,
      ...context.tracking,
      ...context.insights,
      ...context.memories,
      ...context.faqs,
      ...context.entries,
      ...context.documents,
      ...context.knowledgeDocs,
    ].sort((a, b) => b.priority - a.priority);
  }

  private async trackSourceUsage(sources: BrainKnowledgeSource[]) {
    const productIds = sources.filter((s) => s.type === "product").map((s) => s.id);
    const orderIds = sources.filter((s) => s.type === "order").map((s) => s.id);

    if (productIds.length) {
      await this.productService.trackUsage(productIds);
    }
    if (orderIds.length) {
      await this.orderService.trackUsage(orderIds);
    }

    await Promise.all(
      sources.map((source) => {
        if (source.type === "faq") {
          return this.prisma.brainFAQ.update({
            where: { id: source.id },
            data: { usageCount: { increment: 1 } },
          });
        }
        if (source.type === "rule") {
          return this.prisma.brainRule.update({
            where: { id: source.id },
            data: { usageCount: { increment: 1 } },
          });
        }
        return Promise.resolve();
      }),
    );
  }

  private shouldEscalate(question: string, keywords: string[]): boolean {
    const q = question.toLowerCase();
    return keywords.some((kw) => q.includes(kw.toLowerCase()));
  }

  private detectLanguage(text: string): string {
    return /[\u0980-\u09FF]/.test(text) ? "bn" : "en";
  }

  private noKnowledgeMessage(language: string): string {
    return language === "bn"
      ? "Torio Brain-এ এখনও এই বিষয়ে তথ্য নেই। দয়া করে একজন এজেন্টের সাথে কথা বলুন।"
      : "Torio Brain doesn't have information about this yet. Please speak with a human agent.";
  }

  private escalationMessage(language: string): string {
    return language === "bn"
      ? "আপনাকে একজন মানব এজেন্টের সাথে সংযুক্ত করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।"
      : "I'm connecting you with a human agent. Please hold on.";
  }

  private buildResult(
    result: Omit<BrainTestResult, "confidence"> & { confidence?: number },
  ): BrainTestResult {
    return {
      ...result,
      confidence: result.confidence ?? result.confidenceScore / 100,
      breakdown: {
        rulesScore: result.breakdown.rulesScore,
        policyScore: result.breakdown.policyScore,
        orderScore: result.breakdown.orderScore,
        productScore: result.breakdown.productScore,
        faqScore: result.breakdown.faqScore,
        memoryScore: result.breakdown.memoryScore,
        knowledgeScore: result.breakdown.knowledgeScore,
        trackingScore: result.breakdown.trackingScore,
      },
    };
  }
}

function allSourcesSlice(context: Awaited<ReturnType<BrainContextService["buildContext"]>>) {
  return [
    ...context.rules,
    ...context.policies,
    ...context.orders,
    ...context.tracking,
    ...context.products,
    ...context.memories,
  ].slice(0, 5);
}
