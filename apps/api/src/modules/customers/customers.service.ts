import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  ActivityType,
  AssignmentType,
  CustomerStatus,
  LeadSource,
  MembershipRole,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { ActivitiesService } from "../activities/activities.service";
import {
  AssignCustomerDto,
  BulkCustomerActionDto,
  ImportCustomersDto,
  UpdateCustomerDto,
  UpdateCrmSettingsDto,
} from "./dto/customer.dto";

interface ListFilters {
  search?: string;
  status?: CustomerStatus;
  tagId?: string;
  assignedAgentId?: string;
  segmentId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  userId?: string;
  role?: string;
}

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private activities: ActivitiesService,
  ) {}

  private agentScope(role?: string, userId?: string): Prisma.CustomerWhereInput | undefined {
    if (role === MembershipRole.AGENT && userId) {
      return { assignedAgentId: userId };
    }
    return undefined;
  }

  private async segmentFilters(organizationId: string, segmentId: string) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, organizationId, deletedAt: null },
    });
    if (!segment) throw new NotFoundException("Segment not found");
    return this.buildSegmentWhere(organizationId, segment.filters as Record<string, unknown>);
  }

  private buildSegmentWhere(
    organizationId: string,
    filters: Record<string, unknown>,
  ): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { organizationId, deletedAt: null };

    if (filters.customerType) {
      where.customerType = filters.customerType as Prisma.EnumCustomerTypeFilter;
    }
    if (filters.status) {
      where.status = filters.status as CustomerStatus;
    }
    if (filters.leadSource) {
      where.leadSource = filters.leadSource as LeadSource;
    }
    if (filters.channel) {
      where.conversations = {
        some: { channel: { type: filters.channel as Prisma.EnumChannelTypeFilter["equals"] } },
      };
    }
    if (filters.hasConversation) {
      where.conversations = { some: {} };
    }
    if (filters.inactiveDays) {
      const days = Number(filters.inactiveDays);
      where.lastContactAt = { lt: new Date(Date.now() - days * 86400000) };
    }
    if (filters.daysSinceFirstContact) {
      const days = Number(filters.daysSinceFirstContact);
      where.firstContactAt = { gte: new Date(Date.now() - days * 86400000) };
    }

    return where;
  }

  async list(organizationId: string, filters: ListFilters) {
    await this.ensureDefaultSegments(organizationId);

    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    let where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
      ...this.agentScope(filters.role, filters.userId),
    };

    if (filters.segmentId) {
      where = { AND: [where, await this.segmentFilters(organizationId, filters.segmentId)] };
    }

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { whatsappNumber: { contains: filters.search } },
        { instagramProfile: { contains: filters.search, mode: "insensitive" } },
        { facebookProfile: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.status) where.status = filters.status;
    if (filters.assignedAgentId) where.assignedAgentId = filters.assignedAgentId;
    if (filters.tagId) {
      where.tags = { some: { tagId: filters.tagId } };
    }

    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      filters.sortBy === "name"
        ? { fullName: filters.sortDir ?? "asc" }
        : filters.sortBy === "createdAt"
          ? { createdAt: filters.sortDir ?? "desc" }
          : { lastContactAt: filters.sortDir ?? "desc" };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          tags: { include: { tag: true } },
          assignedAgent: { select: { id: true, name: true, email: true } },
          _count: { select: { conversations: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        ...c,
        totalConversations: c._count.conversations,
        tags: c.tags.map((t) => t.tag),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getOne(organizationId: string, customerId: string, role?: string, userId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
        deletedAt: null,
        ...(role === MembershipRole.AGENT && userId ? { assignedAgentId: userId } : {}),
      },
      include: {
        tags: { include: { tag: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        conversations: {
          where: { deletedAt: null },
          orderBy: { lastMessageAt: "desc" },
          include: {
            channel: { select: { type: true, name: true } },
            assignedAgent: { select: { id: true, name: true } },
            tags: { include: { tag: true } },
          },
        },
        _count: { select: { conversations: true, notes: true } },
      },
    });

    if (!customer) throw new NotFoundException("Customer not found");

    const channelStats = await this.prisma.conversation.groupBy({
      by: ["channelId"],
      where: { customerId, organizationId, deletedAt: null },
      _count: true,
    });

    const channels = await this.prisma.channel.findMany({
      where: { id: { in: channelStats.map((c) => c.channelId) } },
      select: { id: true, type: true, name: true },
    });

    return {
      ...customer,
      totalConversations: customer._count.conversations,
      totalNotes: customer._count.notes,
      tags: customer.tags.map((t) => t.tag),
      channels: channelStats.map((stat) => {
        const ch = channels.find((c) => c.id === stat.channelId);
        return { type: ch?.type, name: ch?.name, conversations: stat._count };
      }),
    };
  }

  async update(
    organizationId: string,
    customerId: string,
    dto: UpdateCustomerDto,
    userId: string,
    role?: string,
  ) {
    await this.getOne(organizationId, customerId, role, userId);

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: dto,
      include: {
        tags: { include: { tag: true } },
        assignedAgent: { select: { id: true, name: true, email: true } },
      },
    });

    await this.activities.log({
      organizationId,
      customerId,
      userId,
      type: ActivityType.CUSTOMER_UPDATED,
      title: "Customer profile updated",
      metadata: dto as Record<string, unknown>,
    });

    if (dto.status) {
      await this.activities.log({
        organizationId,
        customerId,
        userId,
        type: ActivityType.STATUS_UPDATED,
        title: `Status changed to ${dto.status}`,
        metadata: { status: dto.status },
      });
    }

    return updated;
  }

  async assign(
    organizationId: string,
    customerId: string,
    dto: AssignCustomerDto,
    assignedById: string,
  ) {
    const customer = await this.getOne(organizationId, customerId);

    await this.prisma.customerAssignment.updateMany({
      where: { customerId, organizationId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });

    await this.prisma.customerAssignment.create({
      data: {
        organizationId,
        customerId,
        assignedToId: dto.assignedToId,
        assignedById,
        assignmentType: AssignmentType.MANUAL,
      },
    });

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { assignedAgentId: dto.assignedToId },
      include: {
        assignedAgent: { select: { id: true, name: true, email: true } },
      },
    });

    const agent = updated.assignedAgent;
    await this.activities.log({
      organizationId,
      customerId,
      userId: assignedById,
      type: ActivityType.CUSTOMER_ASSIGNED,
      title: `Assigned to ${agent?.name ?? agent?.email ?? "agent"}`,
      metadata: { assignedToId: dto.assignedToId, previousAgentId: customer.assignedAgentId },
    });

    return updated;
  }

  async unassign(organizationId: string, customerId: string, userId: string) {
    await this.getOne(organizationId, customerId);

    await this.prisma.customerAssignment.updateMany({
      where: { customerId, organizationId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { assignedAgentId: null },
    });

    await this.activities.log({
      organizationId,
      customerId,
      userId,
      type: ActivityType.CUSTOMER_ASSIGNED,
      title: "Customer unassigned",
    });

    return { success: true };
  }

  async addTag(organizationId: string, customerId: string, tagId: string, userId: string) {
    await this.getOne(organizationId, customerId);
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, organizationId, deletedAt: null },
    });
    if (!tag) throw new NotFoundException("Tag not found");

    await this.prisma.customerTag.upsert({
      where: { customerId_tagId: { customerId, tagId } },
      update: {},
      create: { organizationId, customerId, tagId },
    });

    await this.activities.log({
      organizationId,
      customerId,
      userId,
      type: ActivityType.TAG_ADDED,
      title: `Tag added: ${tag.name}`,
      metadata: { tagId, tagName: tag.name },
    });

    return { success: true };
  }

  async removeTag(organizationId: string, customerId: string, tagId: string, userId: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, organizationId } });
    await this.prisma.customerTag.deleteMany({ where: { customerId, tagId, organizationId } });

    await this.activities.log({
      organizationId,
      customerId,
      userId,
      type: ActivityType.TAG_REMOVED,
      title: `Tag removed: ${tag?.name ?? tagId}`,
      metadata: { tagId },
    });

    return { success: true };
  }

  async bulkAction(organizationId: string, dto: BulkCustomerActionDto, userId: string) {
    if (!dto.customerIds.length) throw new BadRequestException("No customers selected");

    const results = { updated: 0 };

    for (const customerId of dto.customerIds) {
      if (dto.assignedToId) {
        await this.assign(organizationId, customerId, { assignedToId: dto.assignedToId }, userId);
        results.updated++;
      } else if (dto.tagId) {
        await this.addTag(organizationId, customerId, dto.tagId, userId);
        results.updated++;
      } else if (dto.status) {
        await this.update(organizationId, customerId, { status: dto.status }, userId);
        results.updated++;
      }
    }

    return results;
  }

  async exportCsv(organizationId: string, filters: ListFilters) {
    const { items } = await this.list(organizationId, { ...filters, page: 1, pageSize: 10000 });
    const header = "Name,Phone,Email,WhatsApp,Status,Type,Lead Source,Assigned Agent,Tags,Last Contact,Conversations\n";
    const rows = items
      .map((c) =>
        [
          c.fullName ?? "",
          c.phone ?? "",
          c.email ?? "",
          c.whatsappNumber ?? "",
          c.status,
          c.customerType,
          c.leadSource ?? "",
          c.assignedAgent?.name ?? "",
          c.tags.map((t) => t.name).join(";"),
          c.lastContactAt?.toISOString() ?? "",
          c.totalConversations,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    return { csv: header + rows, filename: `customers-${Date.now()}.csv` };
  }

  async importCustomers(organizationId: string, dto: ImportCustomersDto, userId: string) {
    let created = 0;
    let updated = 0;

    for (const row of dto.rows) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            row.phone ? { phone: row.phone } : undefined,
            row.email ? { email: row.email } : undefined,
            row.whatsappNumber ? { whatsappNumber: row.whatsappNumber } : undefined,
          ].filter(Boolean) as Prisma.CustomerWhereInput[],
        },
      });

      if (existing) {
        await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            fullName: row.fullName ?? existing.fullName,
            phone: row.phone ?? existing.phone,
            email: row.email ?? existing.email,
            whatsappNumber: row.whatsappNumber ?? existing.whatsappNumber,
            status: row.status ?? existing.status,
          },
        });
        updated++;
      } else {
        const customer = await this.prisma.customer.create({
          data: {
            organizationId,
            fullName: row.fullName,
            phone: row.phone,
            email: row.email,
            whatsappNumber: row.whatsappNumber,
            status: row.status ?? CustomerStatus.NEW_LEAD,
            leadSource: LeadSource.MANUAL,
            createdById: userId,
            firstContactAt: new Date(),
            lastContactAt: new Date(),
          },
        });

        if (row.tags) {
          for (const tagName of row.tags.split(";").map((t) => t.trim()).filter(Boolean)) {
            const tag = await this.prisma.tag.upsert({
              where: { organizationId_name: { organizationId, name: tagName } },
              update: {},
              create: { organizationId, name: tagName, color: "#6366f1" },
            });
            await this.prisma.customerTag.create({
              data: { organizationId, customerId: customer.id, tagId: tag.id },
            });
          }
        }
        created++;
      }
    }

    return { created, updated };
  }

  async getAnalytics(organizationId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [total, newThisMonth, active, returning, vip, byStatus, bySource] = await Promise.all([
      this.prisma.customer.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.customer.count({
        where: { organizationId, deletedAt: null, createdAt: { gte: monthStart } },
      }),
      this.prisma.customer.count({
        where: { organizationId, deletedAt: null, lastContactAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.customer.count({
        where: {
          organizationId,
          deletedAt: null,
          conversations: { some: {} },
          NOT: { conversations: { none: {} } },
        },
      }),
      this.prisma.customer.count({
        where: { organizationId, deletedAt: null, customerType: "VIP" },
      }),
      this.prisma.customer.groupBy({
        by: ["status"],
        where: { organizationId, deletedAt: null },
        _count: true,
      }),
      this.prisma.customer.groupBy({
        by: ["leadSource"],
        where: { organizationId, deletedAt: null, leadSource: { not: null } },
        _count: true,
      }),
    ]);

    return {
      total,
      newThisMonth,
      active,
      returning,
      vip,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      bySource: bySource.map((s) => ({ source: s.leadSource, count: s._count })),
    };
  }

  async getCrmSettings(organizationId: string) {
    return this.prisma.organizationCrmSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  async updateCrmSettings(organizationId: string, dto: UpdateCrmSettingsDto) {
    return this.prisma.organizationCrmSettings.upsert({
      where: { organizationId },
      update: dto,
      create: { organizationId, ...dto },
    });
  }

  async ensureDefaultSegments(organizationId: string) {
    const count = await this.prisma.customerSegment.count({
      where: { organizationId, isSystem: true },
    });
    if (count > 0) return;

    const defaults = [
      { name: "New Customer", description: "First contact within 7 days", filters: { daysSinceFirstContact: 7 }, color: "#3b82f6" },
      { name: "Returning Customer", description: "Has prior conversations", filters: { hasConversation: true }, color: "#22c55e" },
      { name: "VIP Customer", description: "VIP customers", filters: { customerType: "VIP" }, color: "#8b5cf6" },
      { name: "Inactive Customer", description: "No contact in 30 days", filters: { inactiveDays: 30 }, color: "#94a3b8" },
      { name: "WhatsApp Customers", description: "Customers from WhatsApp", filters: { channel: "WHATSAPP" }, color: "#10b981" },
    ];

    for (const seg of defaults) {
      await this.prisma.customerSegment.create({
        data: {
          organizationId,
          name: seg.name,
          description: seg.description,
          filters: seg.filters,
          color: seg.color,
          type: "SYSTEM",
          isSystem: true,
        },
      });
    }
  }
}
