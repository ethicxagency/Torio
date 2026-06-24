import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CustomMemoryFieldStatus,
  CustomMemoryFieldType,
  CustomMemoryScope,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainKnowledgeSource } from "./brain-context.service";
import {
  CreateCustomMemoryFieldDto,
  CreateMemoryGroupDto,
  ImportCustomMemoryDto,
  ImportCustomMemoryGroupDto,
  ReorderCustomMemoryDto,
  UpdateCustomMemoryFieldDto,
  UpdateCustomMemoryValueDto,
  UpdateMemoryGroupDto,
} from "./dto/brain.dto";

const SYSTEM_TEMPLATES: Array<{
  name: string;
  fieldType: CustomMemoryFieldType;
  description: string;
  scope: CustomMemoryScope;
  options?: string[];
}> = [
  {
    name: "Delivery Charge",
    fieldType: CustomMemoryFieldType.TEXT,
    description: "Standard delivery fee information",
    scope: CustomMemoryScope.BUSINESS,
  },
  {
    name: "Wholesale Policy",
    fieldType: CustomMemoryFieldType.LONG_TEXT,
    description: "Minimum order and wholesale terms",
    scope: CustomMemoryScope.BUSINESS,
  },
  {
    name: "Warranty",
    fieldType: CustomMemoryFieldType.TEXT,
    description: "Product warranty policy",
    scope: CustomMemoryScope.BUSINESS,
  },
  {
    name: "Return Policy",
    fieldType: CustomMemoryFieldType.LONG_TEXT,
    description: "Return and refund policy",
    scope: CustomMemoryScope.BUSINESS,
  },
  {
    name: "Payment Methods",
    fieldType: CustomMemoryFieldType.MULTI_SELECT,
    description: "Accepted payment methods",
    scope: CustomMemoryScope.BUSINESS,
    options: ["Cash On Delivery", "bKash", "Nagad", "Bank Transfer", "Card"],
  },
];

const DEFAULT_GROUPS = [
  { name: "Shipping", description: "Delivery and shipping information" },
  { name: "Payment", description: "Payment methods and policies" },
  { name: "Products", description: "Product-related business info" },
  { name: "Warranty", description: "Warranty and guarantee policies" },
  { name: "Wholesale", description: "Bulk and B2B policies" },
  { name: "Support", description: "Customer support information" },
];

@Injectable()
export class BrainCustomMemoryService {
  constructor(private prisma: PrismaService) {}

  async ensureInitialized(organizationId: string) {
    const groupCount = await this.prisma.memoryGroup.count({ where: { organizationId } });
    if (groupCount === 0) {
      await this.prisma.memoryGroup.createMany({
        data: DEFAULT_GROUPS.map((group, index) => ({
          organizationId,
          name: group.name,
          description: group.description,
          sortOrder: index,
        })),
      });
    }

    const systemTemplateCount = await this.prisma.fieldTemplate.count({
      where: { isSystem: true, organizationId: null },
    });
    if (systemTemplateCount === 0) {
      await this.prisma.fieldTemplate.createMany({
        data: SYSTEM_TEMPLATES.map((template) => ({
          name: template.name,
          fieldType: template.fieldType,
          description: template.description,
          scope: template.scope,
          options: template.options ?? undefined,
          isSystem: true,
        })),
      });
    }
  }

  async listGroups(organizationId: string, includeArchived = false) {
    await this.ensureInitialized(organizationId);
    return this.prisma.memoryGroup.findMany({
      where: {
        organizationId,
        ...(includeArchived ? {} : { isActive: true }),
      },
      include: {
        fields: {
          where: includeArchived ? {} : { status: CustomMemoryFieldStatus.ACTIVE },
          include: { values: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createGroup(organizationId: string, dto: CreateMemoryGroupDto) {
    const maxOrder = await this.prisma.memoryGroup.aggregate({
      where: { organizationId },
      _max: { sortOrder: true },
    });
    return this.prisma.memoryGroup.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        scope: (dto.scope as CustomMemoryScope) ?? CustomMemoryScope.BUSINESS,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateGroup(organizationId: string, id: string, dto: UpdateMemoryGroupDto) {
    await this.getGroup(organizationId, id);
    return this.prisma.memoryGroup.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        scope: dto.scope as CustomMemoryScope | undefined,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async deleteGroup(organizationId: string, id: string) {
    await this.getGroup(organizationId, id);
    await this.prisma.customMemoryField.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });
    await this.prisma.memoryGroup.delete({ where: { id } });
    return { success: true };
  }

  async reorderGroups(organizationId: string, dto: ReorderCustomMemoryDto) {
    await Promise.all(
      dto.ids.map((id, index) =>
        this.prisma.memoryGroup.updateMany({
          where: { id, organizationId },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.listGroups(organizationId);
  }

  async listFields(organizationId: string, options?: { scope?: string; includeArchived?: boolean }) {
    return this.prisma.customMemoryField.findMany({
      where: {
        organizationId,
        ...(options?.scope ? { scope: options.scope as CustomMemoryScope } : {}),
        ...(options?.includeArchived ? {} : { status: CustomMemoryFieldStatus.ACTIVE }),
      },
      include: {
        group: true,
        values: true,
        template: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async createField(organizationId: string, dto: CreateCustomMemoryFieldDto) {
    if (dto.groupId) await this.getGroup(organizationId, dto.groupId);

    const maxOrder = await this.prisma.customMemoryField.aggregate({
      where: { organizationId, groupId: dto.groupId ?? null },
      _max: { sortOrder: true },
    });

    const field = await this.prisma.customMemoryField.create({
      data: {
        organizationId,
        groupId: dto.groupId,
        templateId: dto.templateId,
        name: dto.name,
        fieldType: dto.fieldType as CustomMemoryFieldType,
        description: dto.description,
        options: dto.options == null ? undefined : (dto.options as object),
        scope: (dto.scope as CustomMemoryScope) ?? CustomMemoryScope.BUSINESS,
        sortOrder: dto.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      },
      include: { group: true, values: true },
    });

    if (dto.value != null && dto.value !== "") {
      await this.upsertValue(organizationId, field.id, {
        value: dto.value,
        valueJson: dto.valueJson,
        customerId: dto.customerId,
        productId: dto.productId,
        orderId: dto.orderId,
      });
    }

    return this.getField(organizationId, field.id);
  }

  async updateField(organizationId: string, id: string, dto: UpdateCustomMemoryFieldDto) {
    await this.getField(organizationId, id);
    if (dto.groupId) await this.getGroup(organizationId, dto.groupId);

    await this.prisma.customMemoryField.update({
      where: { id },
      data: {
        groupId: dto.groupId,
        name: dto.name,
        fieldType: dto.fieldType as CustomMemoryFieldType | undefined,
        description: dto.description,
        options: dto.options == null ? undefined : (dto.options as object),
        scope: dto.scope as CustomMemoryScope | undefined,
        sortOrder: dto.sortOrder,
        status: dto.status as CustomMemoryFieldStatus | undefined,
      },
    });

    if (dto.value !== undefined) {
      await this.upsertValue(organizationId, id, {
        value: dto.value,
        valueJson: dto.valueJson,
        customerId: dto.customerId,
        productId: dto.productId,
        orderId: dto.orderId,
      });
    }

    return this.getField(organizationId, id);
  }

  async archiveField(organizationId: string, id: string) {
    await this.getField(organizationId, id);
    return this.prisma.customMemoryField.update({
      where: { id },
      data: { status: CustomMemoryFieldStatus.ARCHIVED },
    });
  }

  async deleteField(organizationId: string, id: string) {
    await this.getField(organizationId, id);
    await this.prisma.customMemoryValue.deleteMany({ where: { fieldId: id } });
    await this.prisma.customMemoryField.delete({ where: { id } });
    return { success: true };
  }

  async reorderFields(organizationId: string, dto: ReorderCustomMemoryDto) {
    await Promise.all(
      dto.ids.map((id, index) =>
        this.prisma.customMemoryField.updateMany({
          where: { id, organizationId },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.listFields(organizationId);
  }

  async upsertValue(organizationId: string, fieldId: string, dto: UpdateCustomMemoryValueDto) {
    const field = await this.getField(organizationId, fieldId);
    const entityKey = this.buildEntityKey(dto.customerId, dto.productId, dto.orderId);

    return this.prisma.customMemoryValue.upsert({
      where: { fieldId_entityKey: { fieldId, entityKey } },
      create: {
        organizationId,
        fieldId,
        entityKey,
        value: dto.value ?? this.stringifyValue(dto.valueJson),
        valueJson: dto.valueJson ?? undefined,
        customerId: dto.customerId,
        productId: dto.productId,
        orderId: dto.orderId,
      },
      update: {
        value: dto.value ?? this.stringifyValue(dto.valueJson),
        valueJson: dto.valueJson ?? undefined,
      },
    });
  }

  async getWorkspace(organizationId: string, query?: string) {
    await this.ensureInitialized(organizationId);
    const groups = await this.listGroups(organizationId, true);
    const templates = await this.listTemplates(organizationId);

    if (!query?.trim()) {
      return { groups, templates };
    }

    const q = query.toLowerCase();
    const filteredGroups = groups
      .map((group) => ({
        ...group,
        fields: group.fields.filter(
          (field) =>
            field.name.toLowerCase().includes(q) ||
            field.description?.toLowerCase().includes(q) ||
            field.values.some((v) => v.value?.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.fields.length > 0 || group.name.toLowerCase().includes(q));

    return { groups: filteredGroups, templates };
  }

  async listTemplates(organizationId: string) {
    return this.prisma.fieldTemplate.findMany({
      where: {
        OR: [{ isSystem: true, organizationId: null }, { organizationId }],
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async globalSearch(organizationId: string, query: string, limit = 20) {
    const q = query.trim().toLowerCase();
    if (!q) return { results: [] };

    const [
      customFields,
      rules,
      faqs,
      entries,
      products,
      customerMemories,
    ] = await Promise.all([
      this.prisma.customMemoryField.findMany({
        where: {
          organizationId,
          status: CustomMemoryFieldStatus.ACTIVE,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { values: true, group: true },
        take: limit,
      }),
      this.prisma.brainRule.findMany({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
      }),
      this.prisma.brainFAQ.findMany({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
          OR: [
            { question: { contains: q, mode: "insensitive" } },
            { answer: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
      }),
      this.prisma.brainEntry.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { label: { contains: q, mode: "insensitive" } },
            { value: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { category: true },
        take: limit,
      }),
      this.prisma.productMemory.findMany({
        where: {
          organizationId,
          deletedAt: null,
          isActive: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
      }),
      this.prisma.customerMemory.findMany({
        where: {
          organizationId,
          deletedAt: null,
          memory: { contains: q, mode: "insensitive" },
        },
        take: limit,
      }),
    ]);

    const valueMatches = await this.prisma.customMemoryValue.findMany({
      where: {
        organizationId,
        value: { contains: q, mode: "insensitive" },
      },
      include: { field: { include: { group: true } } },
      take: limit,
    });

    const results = [
      ...customFields.map((field) => ({
        type: "custom_field" as const,
        id: field.id,
        label: field.name,
        content: this.formatFieldValue(field),
        group: field.group?.name,
      })),
      ...valueMatches
        .filter((v) => !customFields.some((f) => f.id === v.fieldId))
        .map((v) => ({
          type: "custom_field" as const,
          id: v.fieldId,
          label: v.field.name,
          content: v.value ?? "",
          group: v.field.group?.name,
        })),
      ...rules.map((rule) => ({
        type: "rule" as const,
        id: rule.id,
        label: rule.name,
        content: rule.description,
      })),
      ...faqs.map((faq) => ({
        type: "faq" as const,
        id: faq.id,
        label: faq.question,
        content: faq.answer,
      })),
      ...entries.map((entry) => ({
        type: "business_memory" as const,
        id: entry.id,
        label: `${entry.category.title}: ${entry.label}`,
        content: entry.value,
      })),
      ...products.map((product) => ({
        type: "product" as const,
        id: product.id,
        label: product.name,
        content: product.description ?? "",
      })),
      ...customerMemories.map((memory) => ({
        type: "customer_memory" as const,
        id: memory.id,
        label: "Customer Memory",
        content: memory.memory,
      })),
    ].slice(0, limit);

    return { results, query };
  }

  async getRelevantCustomFields(
    organizationId: string,
    customerMessage: string,
    customerId?: string,
  ): Promise<BrainKnowledgeSource[]> {
    const fields = await this.prisma.customMemoryField.findMany({
      where: {
        organizationId,
        status: CustomMemoryFieldStatus.ACTIVE,
        scope: CustomMemoryScope.BUSINESS,
      },
      include: { values: true, group: true },
      orderBy: { sortOrder: "asc" },
    });

    const query = customerMessage.toLowerCase();
    const words = query.split(/\s+/).filter((w) => w.length > 2);

    return fields
      .map((field) => {
        const value = field.values.find((v) => v.entityKey === "org") ?? field.values[0];
        const text = `${field.name} ${field.description ?? ""} ${value?.value ?? ""}`;
        const normalized = text.toLowerCase();

        let score = 0;
        for (const word of words) {
          if (normalized.includes(word)) score += 1;
        }
        if (field.name.toLowerCase().includes(query) || query.includes(field.name.toLowerCase())) {
          score += 3;
        }

        const content = value?.value ?? "No value set";
        const groupLabel = field.group?.name ? `${field.group.name} · ` : "";

        return {
          field,
          score,
          source: {
            type: "custom_field" as const,
            id: field.id,
            label: `${groupLabel}${field.name}`,
            content: field.description ? `${content}\n(${field.description})` : content,
            priority: 88 + score,
          },
        };
      })
      .filter((item) => item.score > 0 && item.field.values.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.source);
  }

  async exportData(organizationId: string, format: "json" | "csv" = "json") {
    const groups = await this.listGroups(organizationId, true);
    const payload = {
      exportedAt: new Date().toISOString(),
      groups: groups.map((group) => ({
        name: group.name,
        description: group.description,
        scope: group.scope,
        sortOrder: group.sortOrder,
        fields: group.fields.map((field) => ({
          name: field.name,
          fieldType: field.fieldType,
          description: field.description,
          options: field.options,
          scope: field.scope,
          sortOrder: field.sortOrder,
          status: field.status,
          value: field.values.find((v) => v.entityKey === "org")?.value ?? field.values[0]?.value,
        })),
      })),
    };

    if (format === "json") {
      return { format: "json", data: payload };
    }

    const rows = [
      "group,name,fieldType,description,value,scope,status,sortOrder",
      ...payload.groups.flatMap((group) =>
        group.fields.map((field) =>
          [
            this.csvEscape(group.name),
            this.csvEscape(field.name),
            field.fieldType,
            this.csvEscape(field.description ?? ""),
            this.csvEscape(field.value ?? ""),
            field.scope,
            field.status,
            field.sortOrder,
          ].join(","),
        ),
      ),
    ];

    return { format: "csv", data: rows.join("\n") };
  }

  async importData(organizationId: string, dto: ImportCustomMemoryDto) {
    let groups: ImportCustomMemoryGroupDto[] = dto.groups ?? [];

    if (dto.format === "csv" && dto.csv) {
      groups = this.parseCsvImport(dto.csv);
    }

    let imported = 0;
    for (const groupData of groups) {
      let group = await this.prisma.memoryGroup.findFirst({
        where: { organizationId, name: groupData.name },
      });
      if (!group) {
        group = await this.createGroup(organizationId, {
          name: groupData.name,
          description: groupData.description,
          scope: groupData.scope,
        });
      }

      for (const fieldData of groupData.fields ?? []) {
        const existing = await this.prisma.customMemoryField.findFirst({
          where: { organizationId, name: fieldData.name, groupId: group.id },
        });
        if (existing) {
          await this.updateField(organizationId, existing.id, {
            ...fieldData,
            groupId: group.id,
          });
        } else {
          await this.createField(organizationId, { ...fieldData, groupId: group.id });
        }
        imported++;
      }
    }

    return { imported, groups: await this.listGroups(organizationId) };
  }

  private async getGroup(organizationId: string, id: string) {
    const group = await this.prisma.memoryGroup.findFirst({
      where: { id, organizationId },
    });
    if (!group) throw new NotFoundException("Memory group not found");
    return group;
  }

  async getField(organizationId: string, id: string) {
    const field = await this.prisma.customMemoryField.findFirst({
      where: { id, organizationId },
      include: { group: true, values: true, template: true },
    });
    if (!field) throw new NotFoundException("Custom memory field not found");
    return field;
  }

  private buildEntityKey(customerId?: string, productId?: string, orderId?: string) {
    if (customerId) return `customer:${customerId}`;
    if (productId) return `product:${productId}`;
    if (orderId) return `order:${orderId}`;
    return "org";
  }

  private stringifyValue(valueJson?: unknown) {
    if (valueJson == null) return null;
    if (typeof valueJson === "string") return valueJson;
    return JSON.stringify(valueJson);
  }

  private formatFieldValue(field: { values: Array<{ value: string | null }> }) {
    const value = field.values.find((v) => v.value)?.value;
    return value ?? "";
  }

  private csvEscape(value: string) {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private parseCsvImport(csv: string): ImportCustomMemoryGroupDto[] {
    const lines = csv.trim().split("\n").slice(1);
    const groupMap = new Map<string, ImportCustomMemoryGroupDto>();

    for (const line of lines) {
      const [groupName, name, fieldType, description, value, scope, status, sortOrder] =
        this.parseCsvLine(line);
      if (!groupName || !name) continue;

      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { name: groupName, fields: [] });
      }
      groupMap.get(groupName)!.fields!.push({
        name,
        fieldType: fieldType as CustomMemoryFieldType,
        description: description || undefined,
        value: value || undefined,
        scope: (scope as CustomMemoryScope) || CustomMemoryScope.BUSINESS,
        status: (status as CustomMemoryFieldStatus) || CustomMemoryFieldStatus.ACTIVE,
        sortOrder: sortOrder ? Number(sortOrder) : undefined,
      });
    }

    return Array.from(groupMap.values());
  }

  private parseCsvLine(line: string) {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    result.push(current);
    return result;
  }
}
