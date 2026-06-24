import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainBrandVoiceService } from "./brain-brand-voice.service";
import { BrainMemoryService } from "./brain-memory.service";
import { BrainProductService } from "./brain-product.service";
import { BrainOrderService } from "./brain-order.service";
import { BrainInsightService } from "./brain-insight.service";
import { BrainCustomMemoryService } from "./brain-custom-memory.service";
import { BrainPolicyService } from "./brain-policy.service";
import { BrainTrackingService } from "../tracking/brain-tracking.service";

export interface BrainKnowledgeSource {
  type: "rule" | "faq" | "entry" | "document" | "memory" | "knowledge" | "product" | "order" | "insight" | "custom_field" | "policy" | "tracking";
  id: string;
  label: string;
  content: string;
  priority: number;
}

export interface BrainContext {
  rules: BrainKnowledgeSource[];
  customFields: BrainKnowledgeSource[];
  policies: BrainKnowledgeSource[];
  orders: BrainKnowledgeSource[];
  tracking: BrainKnowledgeSource[];
  products: BrainKnowledgeSource[];
  insights: BrainKnowledgeSource[];
  faqs: BrainKnowledgeSource[];
  entries: BrainKnowledgeSource[];
  documents: BrainKnowledgeSource[];
  memories: BrainKnowledgeSource[];
  knowledgeDocs: BrainKnowledgeSource[];
  brandVoicePrompt: string;
  systemPrompt: string;
}

@Injectable()
export class BrainContextService {
  constructor(
    private prisma: PrismaService,
    private brandVoiceService: BrainBrandVoiceService,
    private memoryService: BrainMemoryService,
    private productService: BrainProductService,
    private orderService: BrainOrderService,
    private insightService: BrainInsightService,
    private customMemoryService: BrainCustomMemoryService,
    private policyService: BrainPolicyService,
    private trackingService: BrainTrackingService,
  ) {}

  async buildContext(
    organizationId: string,
    customerMessage: string,
    customerId?: string,
    channelId?: string,
  ): Promise<BrainContext> {
    const query = customerMessage.toLowerCase();

    const channelPromise = channelId
      ? this.prisma.channel.findFirst({
          where: { id: channelId, organizationId, deletedAt: null },
          include: {
            connection: {
              select: {
                pageName: true,
                pageId: true,
                instagramUsername: true,
                whatsappPhoneNumber: true,
              },
            },
          },
        })
      : Promise.resolve(null);

    const [rules, faqs, entries, documents, knowledgeDocs, org, brandVoice, memories, products, orders, tracking, insight, customFields, policies, channel] =
      await Promise.all([
        this.prisma.brainRule.findMany({
          where: { organizationId, deletedAt: null, isActive: true },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        }),
        this.prisma.brainFAQ.findMany({
          where: { organizationId, deletedAt: null, isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        this.prisma.brainEntry.findMany({
          where: { organizationId, deletedAt: null, NOT: { value: "" } },
          include: { category: true },
          orderBy: { sortOrder: "asc" },
        }),
        this.prisma.brainDocument.findMany({
          where: { organizationId, deletedAt: null, status: "READY", NOT: { content: null } },
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.knowledgeDocument.findMany({
          where: {
            organizationId,
            deletedAt: null,
            status: "READY",
            NOT: { content: null },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        }),
        this.brandVoiceService.get(organizationId),
        this.memoryService.getRelevantMemories(organizationId, customerId, customerMessage),
        this.productService.getRelevantProducts(organizationId, customerMessage),
        this.orderService.getRelevantOrders(organizationId, customerMessage, customerId),
        this.trackingService.getRelevantTracking(organizationId, customerMessage, customerId),
        customerId
          ? this.insightService.getForCustomer(organizationId, customerId).catch(() => null)
          : Promise.resolve(null),
        this.customMemoryService.getRelevantCustomFields(organizationId, customerMessage, customerId),
        this.policyService.getRelevantPolicies(organizationId, customerMessage),
        channelPromise,
      ]);

    const insightSources: BrainKnowledgeSource[] = insight
      ? [
          {
            type: "insight",
            id: insight.id,
            label: "Customer Insights",
            content: this.insightService.formatInsightForPrompt(insight),
            priority: 72,
          },
        ]
      : [];

    const brandVoicePrompt = this.brandVoiceService.buildVoicePrompt(brandVoice);

    const scoredFaqs = faqs
      .map((faq) => ({ faq, score: this.scoreTextMatch(query, `${faq.question} ${faq.answer}`) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const scoredEntries = entries
      .map((entry) => ({
        entry,
        score: this.scoreTextMatch(query, `${entry.label} ${entry.value}`),
      }))
      .filter((item) => item.score > 0 || item.entry.category.type !== "CUSTOM")
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const scoredDocs = documents
      .map((doc) => ({
        doc,
        score: this.scoreTextMatch(query, `${doc.title} ${doc.content ?? ""}`),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const scoredKnowledge = knowledgeDocs
      .map((doc) => ({
        doc,
        score: this.scoreTextMatch(query, `${doc.title} ${doc.content ?? ""}`),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const ruleSources: BrainKnowledgeSource[] = rules.map((rule) => ({
      type: "rule",
      id: rule.id,
      label: rule.name || "Business Rule",
      content: rule.description || rule.rule,
      priority: 100 + rule.priority,
    }));

    const faqSources: BrainKnowledgeSource[] = scoredFaqs.map(({ faq, score }) => ({
      type: "faq",
      id: faq.id,
      label: faq.question,
      content: faq.answer,
      priority: 80 + score,
    }));

    const entrySources: BrainKnowledgeSource[] = scoredEntries.map(({ entry, score }) => ({
      type: "entry",
      id: entry.id,
      label: `${entry.category.title}: ${entry.label}`,
      content: entry.value,
      priority: 60 + score,
    }));

    const docSources: BrainKnowledgeSource[] = scoredDocs.map(({ doc, score }) => ({
      type: "document",
      id: doc.id,
      label: doc.title,
      content: (doc.content ?? "").slice(0, 2000),
      priority: 40 + score,
    }));

    const knowledgeSources: BrainKnowledgeSource[] = scoredKnowledge.map(({ doc, score }) => ({
      type: "knowledge",
      id: doc.id,
      label: doc.title,
      content: (doc.content ?? "").slice(0, 2000),
      priority: 35 + score,
    }));

    const channelContext = channel ? this.formatChannelContext(channel) : "";

    const systemPrompt = [
      `You are Torio AI assistant for ${org?.name ?? "this business"}.`,
      channelContext,
      brandVoicePrompt,
      "Answer ONLY using the Torio Brain knowledge provided below.",
      "Never guess or invent policies, prices, delivery times, or payment methods.",
      "If the answer is not in Torio Brain, say you need to connect the customer with a human agent.",
      "Business rules MUST always be followed and override everything else.",
      "Custom memory fields contain merchant-defined business facts — use them before general knowledge.",
      "Merchant policies (return, refund, exchange, cancellation, shipping, payment) MUST be used for policy questions — never guess.",
      "Use order memory for order status, tracking, and delivery questions.",
      "Use live courier tracking data when available — it overrides stale order memory status.",
      "Use product memory for product-related questions — never invent product details.",
      "Use customer memory when relevant to personalize the response.",
    ].join("\n");

    return {
      rules: ruleSources,
      customFields,
      policies,
      orders,
      tracking,
      products,
      insights: insightSources,
      faqs: faqSources,
      entries: entrySources,
      documents: docSources,
      memories,
      knowledgeDocs: knowledgeSources,
      brandVoicePrompt,
      systemPrompt,
    };
  }

  formatContextForPrompt(context: BrainContext): string {
    const sections: string[] = [];

    if (context.rules.length) {
      sections.push(
        "=== PRIORITY 1: BUSINESS RULES (MUST FOLLOW) ===",
        ...context.rules.map((r) => `- ${r.label}: ${r.content}`),
      );
    }

    if (context.customFields.length) {
      sections.push(
        "=== PRIORITY 2: CUSTOM MEMORY FIELDS ===",
        ...context.customFields.map((f) => `- ${f.label}: ${f.content}`),
      );
    }

    if (context.policies.length) {
      sections.push(
        "=== PRIORITY 3: MERCHANT POLICIES (RETURN / REFUND / EXCHANGE / CANCELLATION / SHIPPING / PAYMENT) ===",
        ...context.policies.map((p) => `- ${p.label}: ${p.content}`),
      );
    }

    if (context.products.length) {
      sections.push(
        "=== PRIORITY 4: PRODUCT MEMORY ===",
        ...context.products.map((p) => `[${p.label}]\n${p.content}`),
      );
    }

    if (context.orders.length) {
      sections.push(
        "=== PRIORITY 5: ORDER MEMORY ===",
        ...context.orders.map((o) => `[${o.label}]\n${o.content}`),
      );
    }

    if (context.tracking.length) {
      sections.push(
        "=== PRIORITY 5B: LIVE COURIER TRACKING ===",
        ...context.tracking.map((t) => `[${t.label}]\n${t.content}`),
      );
    }

    if (context.insights.length) {
      sections.push(
        "=== CUSTOMER INSIGHTS ===",
        ...context.insights.map((i) => i.content),
      );
    }

    if (context.memories.length) {
      sections.push(
        "=== PRIORITY 6: CUSTOMER MEMORY ===",
        ...context.memories.map((m) => `- ${m.content}`),
      );
    }

    if (context.faqs.length) {
      sections.push(
        "=== FAQ ANSWERS ===",
        ...context.faqs.map((f) => `Q: ${f.label}\nA: ${f.content}`),
      );
    }

    if (context.entries.length) {
      sections.push(
        "=== BUSINESS INFORMATION ===",
        ...context.entries.map((e) => `${e.label}: ${e.content}`),
      );
    }

    const docs = [...context.documents, ...context.knowledgeDocs];
    if (docs.length) {
      sections.push(
        "=== PRIORITY 7: DOCUMENT & KNOWLEDGE BASE ===",
        ...docs.map((d) => `[${d.label}]\n${d.content}`),
      );
    }

    return sections.join("\n\n");
  }

  private formatChannelContext(
    channel: {
      type: string;
      name: string;
      connection: {
        pageName: string | null;
        pageId: string | null;
        instagramUsername: string | null;
        whatsappPhoneNumber: string | null;
      } | null;
    },
  ): string {
    const lines = [`You are replying on the ${channel.type} channel.`];

    if (channel.type === "MESSENGER" && channel.connection?.pageName) {
      lines.push(`Facebook Page: ${channel.connection.pageName} (${channel.connection.pageId ?? "unknown"}).`);
    } else if (channel.type === "INSTAGRAM" && channel.connection?.instagramUsername) {
      lines.push(`Instagram account: @${channel.connection.instagramUsername}.`);
    } else if (channel.type === "WHATSAPP" && channel.connection?.whatsappPhoneNumber) {
      lines.push(`WhatsApp number: ${channel.connection.whatsappPhoneNumber}.`);
    } else {
      lines.push(`Account name: ${channel.name}.`);
    }

    lines.push("Tailor tone and references to this specific connected account when relevant.");
    return lines.join("\n");
  }

  private scoreTextMatch(query: string, text: string): number {
    const normalized = text.toLowerCase();
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) return 0;

    let score = 0;
    for (const word of words) {
      if (normalized.includes(word)) score += 1;
    }
    return score;
  }
}
