import { Injectable, NotFoundException } from "@nestjs/common";
import { BrainCategoryType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BRAIN_CATEGORY_META, BRAIN_CATEGORY_TYPES } from "./brain.constants";
import {
  CreateBrainFaqDto,
  CreateBrainRuleDto,
  CreateCustomEntryDto,
  UpdateBrainFaqDto,
  UpdateBrainRuleDto,
  UpdateBrainSettingsDto,
  UpsertBrainEntriesDto,
} from "./dto/brain.dto";

@Injectable()
export class BrainService {
  constructor(private prisma: PrismaService) {}

  async ensureInitialized(organizationId: string) {
    const existing = await this.prisma.brainCategory.count({ where: { organizationId } });
    if (existing > 0) return;

    for (const type of BRAIN_CATEGORY_TYPES) {
      const meta = BRAIN_CATEGORY_META[type];
      const category = await this.prisma.brainCategory.create({
        data: {
          organizationId,
          type,
          title: meta.title,
          sortOrder: meta.sortOrder,
        },
      });

      if (meta.fields.length > 0) {
        await this.prisma.brainEntry.createMany({
          data: meta.fields.map((field, index) => ({
            organizationId,
            categoryId: category.id,
            key: field.key,
            label: field.label,
            value: "",
            sortOrder: index,
          })),
        });
      }
    }

    await this.prisma.brainSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });

    await this.prisma.brandVoice.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  async getOverview(organizationId: string) {
    await this.ensureInitialized(organizationId);

    const [settings, analytics] = await Promise.all([
      this.prisma.brainSettings.findUniqueOrThrow({ where: { organizationId } }),
      this.getAnalytics(organizationId),
    ]);

    return { settings, analytics };
  }

  async getAnalytics(organizationId: string) {
    await this.ensureInitialized(organizationId);

    const [
      entryCount,
      faqCount,
      ruleCount,
      documentCount,
      filledEntries,
      memoryCount,
      pendingSuggestions,
      avgConfidence,
      productCount,
      orderCount,
      orderRevenue,
      topFaqs,
      topRules,
    ] = await Promise.all([
        this.prisma.brainEntry.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.brainFAQ.count({ where: { organizationId, deletedAt: null, isActive: true } }),
        this.prisma.brainRule.count({ where: { organizationId, deletedAt: null, isActive: true } }),
        this.prisma.brainDocument.count({ where: { organizationId, deletedAt: null, status: "READY" } }),
        this.prisma.brainEntry.count({
          where: { organizationId, deletedAt: null, NOT: { value: "" } },
        }),
        this.prisma.customerMemory.count({ where: { organizationId, deletedAt: null } }),
        this.prisma.learningSuggestion.count({
          where: { organizationId, status: "PENDING" },
        }),
        this.prisma.aiConfidenceLog.aggregate({
          where: { organizationId },
          _avg: { confidenceScore: true },
        }),
        this.prisma.productMemory.count({
          where: { organizationId, deletedAt: null, isActive: true },
        }),
        this.prisma.orderMemory.count({
          where: { organizationId, deletedAt: null },
        }),
        this.prisma.orderMemory.aggregate({
          where: { organizationId, deletedAt: null },
          _sum: { orderValue: true },
        }),
        this.prisma.brainFAQ.findMany({
          where: { organizationId, deletedAt: null, isActive: true },
          orderBy: { usageCount: "desc" },
          take: 5,
          select: { id: true, question: true, usageCount: true },
        }),
        this.prisma.brainRule.findMany({
          where: { organizationId, deletedAt: null, isActive: true },
          orderBy: { usageCount: "desc" },
          take: 5,
          select: { id: true, rule: true, usageCount: true },
        }),
      ]);

    return {
      totalKnowledgeEntries: entryCount,
      filledKnowledgeEntries: filledEntries,
      totalFaqs: faqCount,
      totalRules: ruleCount,
      totalDocuments: documentCount,
      totalMemories: memoryCount,
      totalProducts: productCount,
      totalOrders: orderCount,
      totalOrderRevenue: orderRevenue._sum.orderValue ?? 0,
      suggestedKnowledge: pendingSuggestions,
      averageConfidence: Math.round(avgConfidence._avg.confidenceScore ?? 0),
      aiUsage: topFaqs.reduce((sum, f) => sum + f.usageCount, 0) + topRules.reduce((sum, r) => sum + r.usageCount, 0),
      mostUsedFaqs: topFaqs,
      mostUsedRules: topRules,
    };
  }

  async getGrowthAnalytics(organizationId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const [entries, faqs, documents, suggestions, memories, confidenceLogs] = await Promise.all([
      this.prisma.brainEntry.findMany({
        where: {
          organizationId,
          deletedAt: null,
          NOT: { value: "" },
          updatedAt: { gte: since },
        },
        select: { updatedAt: true },
      }),
      this.prisma.brainFAQ.findMany({
        where: { organizationId, deletedAt: null, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.brainDocument.findMany({
        where: { organizationId, deletedAt: null, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.learningSuggestion.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.customerMemory.findMany({
        where: { organizationId, deletedAt: null, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.prisma.aiConfidenceLog.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { confidenceScore: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const knowledgeItems = [
      ...entries.map((e) => ({ createdAt: e.updatedAt })),
      ...faqs,
      ...documents,
    ];
    const learningItems = [...suggestions, ...memories];

    return {
      knowledgeGrowth: this.buildDailyTrend(knowledgeItems),
      learningGrowth: this.buildDailyTrend(learningItems),
      confidenceTrend: this.buildConfidenceTrend(confidenceLogs),
    };
  }

  private buildDailyTrend(items: { createdAt: Date }[]) {
    const days = 30;
    const map = new Map<string, number>();
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0, 10), 0);
    }

    for (const item of items) {
      const key = item.createdAt.toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    }

    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }

  private buildConfidenceTrend(logs: { confidenceScore: number; createdAt: Date }[]) {
    const byDate = new Map<string, { total: number; count: number }>();

    for (const log of logs) {
      const key = log.createdAt.toISOString().slice(0, 10);
      const current = byDate.get(key) ?? { total: 0, count: 0 };
      current.total += log.confidenceScore;
      current.count += 1;
      byDate.set(key, current);
    }

    const days = 30;
    const now = new Date();
    const trend: { date: string; score: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const bucket = byDate.get(key);
      trend.push({
        date: key,
        score: bucket ? Math.round(bucket.total / bucket.count) : 0,
      });
    }

    return trend;
  }

  async getSettings(organizationId: string) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainSettings.findUniqueOrThrow({ where: { organizationId } });
  }

  async updateSettings(organizationId: string, dto: UpdateBrainSettingsDto) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainSettings.update({
      where: { organizationId },
      data: dto,
    });
  }

  async getCategoriesWithEntries(organizationId: string) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainCategory.findMany({
      where: { organizationId },
      orderBy: { sortOrder: "asc" },
      include: {
        entries: {
          where: { deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  async upsertCategoryEntries(
    organizationId: string,
    type: BrainCategoryType,
    dto: UpsertBrainEntriesDto,
  ) {
    await this.ensureInitialized(organizationId);

    const category = await this.prisma.brainCategory.findUnique({
      where: { organizationId_type: { organizationId, type } },
    });
    if (!category) throw new NotFoundException("Brain category not found");

    await this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.brainEntry.upsert({
          where: {
            organizationId_categoryId_key: {
              organizationId,
              categoryId: category.id,
              key: entry.key,
            },
          },
          update: { value: entry.value },
          create: {
            organizationId,
            categoryId: category.id,
            key: entry.key,
            label: entry.key.replace(/_/g, " "),
            value: entry.value,
          },
        }),
      ),
    );

    return this.getCategoriesWithEntries(organizationId);
  }

  async createCustomEntry(organizationId: string, dto: CreateCustomEntryDto) {
    await this.ensureInitialized(organizationId);

    const category = await this.prisma.brainCategory.findUniqueOrThrow({
      where: { organizationId_type: { organizationId, type: "CUSTOM" } },
    });

    const key = `custom_${Date.now().toString(36)}`;
    return this.prisma.brainEntry.create({
      data: {
        organizationId,
        categoryId: category.id,
        key,
        label: dto.label,
        value: dto.value,
        sortOrder: 999,
      },
    });
  }

  async deleteEntry(organizationId: string, entryId: string) {
    const entry = await this.prisma.brainEntry.findFirst({
      where: { id: entryId, organizationId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException("Entry not found");

    await this.prisma.brainEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async listRules(organizationId: string) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainRule.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  async createRule(organizationId: string, dto: CreateBrainRuleDto) {
    await this.ensureInitialized(organizationId);
    const description = dto.description ?? dto.rule ?? "";
    return this.prisma.brainRule.create({
      data: {
        organizationId,
        name: dto.name,
        description,
        rule: description,
        type: dto.type ?? "CUSTOM",
        priority: dto.priority ?? 0,
      },
    });
  }

  async updateRule(organizationId: string, id: string, dto: UpdateBrainRuleDto) {
    const rule = await this.prisma.brainRule.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException("Rule not found");

    const data = { ...dto } as UpdateBrainRuleDto & { rule?: string };
    if (dto.description) data.rule = dto.description;

    return this.prisma.brainRule.update({ where: { id }, data });
  }

  async deleteRule(organizationId: string, id: string) {
    const rule = await this.prisma.brainRule.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException("Rule not found");

    await this.prisma.brainRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async listFaqs(organizationId: string) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainFAQ.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async createFaq(organizationId: string, dto: CreateBrainFaqDto) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainFAQ.create({
      data: {
        organizationId,
        question: dto.question,
        answer: dto.answer,
      },
    });
  }

  async updateFaq(organizationId: string, id: string, dto: UpdateBrainFaqDto) {
    const faq = await this.prisma.brainFAQ.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!faq) throw new NotFoundException("FAQ not found");

    return this.prisma.brainFAQ.update({ where: { id }, data: dto });
  }

  async deleteFaq(organizationId: string, id: string) {
    const faq = await this.prisma.brainFAQ.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!faq) throw new NotFoundException("FAQ not found");

    await this.prisma.brainFAQ.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async listDocuments(organizationId: string) {
    await this.ensureInitialized(organizationId);
    return this.prisma.brainDocument.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteDocument(organizationId: string, id: string) {
    const doc = await this.prisma.brainDocument.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException("Document not found");

    await this.prisma.brainDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }
}
