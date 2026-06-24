import { Injectable, NotFoundException } from "@nestjs/common";
import { ChannelType, ConversationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { InboxGateway } from "../inbox/inbox.gateway";
import { InboxSearchService } from "../inbox/inbox-search.service";
import { ListConversationsDto, AssignConversationDto } from "./dto/conversation.dto";

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: InboxGateway,
    private search: InboxSearchService,
  ) {}

  private conversationInclude = {
    channel: {
      select: {
        id: true,
        type: true,
        name: true,
        connection: {
          select: {
            pageName: true,
            pageId: true,
            instagramUsername: true,
            whatsappPhoneNumber: true,
          },
        },
      },
    },
    customer: {
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        phone: true,
        email: true,
        whatsappNumber: true,
        instagramProfile: true,
        facebookProfile: true,
        status: true,
        firstContactAt: true,
        lastContactAt: true,
      },
    },
    assignedAgent: { select: { id: true, name: true, avatarUrl: true } },
    tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
  };

  async list(
    organizationId: string,
    userId: string,
    query: ListConversationsDto,
  ) {
    const pageSize = 25;
    const where: Prisma.ConversationWhereInput = {
      organizationId,
      deletedAt: null,
    };

    switch (query.filter) {
      case "open":
        where.status = ConversationStatus.OPEN;
        break;
      case "closed":
        where.status = ConversationStatus.CLOSED;
        break;
      case "assigned":
        where.assignedAgentId = { not: null };
        break;
      case "unassigned":
        where.assignedAgentId = null;
        where.status = { in: [ConversationStatus.OPEN, ConversationStatus.PENDING] };
        break;
      case "mine":
        where.assignedAgentId = userId;
        break;
    }

    if (query.status) where.status = query.status;
    if (query.channelId) {
      where.channelId = query.channelId;
    } else if (query.channelType) {
      where.channel = { type: query.channelType as ChannelType };
    }
    if (query.assignedAgentId) where.assignedAgentId = query.assignedAgentId;
    if (query.tagId) where.tags = { some: { tagId: query.tagId } };

    const searchCondition = query.search
      ? this.search.buildSearchCondition(query.search)
      : undefined;
    if (searchCondition) Object.assign(where, searchCondition);

    const sortField = query.sort ?? "lastMessageAt";
    const sortOrder = query.order ?? "desc";

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: this.conversationInclude,
        orderBy: { [sortField]: sortOrder },
        take: pageSize + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const hasMore = items.length > pageSize;
    const page = hasMore ? items.slice(0, pageSize) : items;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    return {
      items: page.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.tag),
      })),
      total,
      nextCursor,
      hasMore,
    };
  }

  async getOne(organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId, deletedAt: null },
      include: {
        ...this.conversationInclude,
        assignments: {
          where: { isActive: true },
          include: {
            assignedTo: { select: { id: true, name: true, avatarUrl: true } },
            assignedBy: { select: { id: true, name: true } },
          },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
    });

    if (!conversation) throw new NotFoundException("Conversation not found");

    const totalConversations = await this.prisma.conversation.count({
      where: { organizationId, customerId: conversation.customerId, deletedAt: null },
    });

    return {
      ...conversation,
      tags: conversation.tags.map((t) => t.tag),
      customer: {
        ...conversation.customer,
        totalConversations,
      },
    };
  }

  async markRead(organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.updateMany({
      where: { id: conversationId, organizationId },
      data: { unreadCount: 0 },
    });
    return { updated: conversation.count > 0 };
  }

  async updateStatus(
    organizationId: string,
    conversationId: string,
    status: ConversationStatus,
  ) {
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status,
        closedAt: status === ConversationStatus.CLOSED ? new Date() : null,
      },
      include: this.conversationInclude,
    });

    this.gateway.emitConversationUpdated(organizationId, {
      ...conversation,
      tags: conversation.tags.map((t) => t.tag),
    });

    return conversation;
  }

  async assign(
    organizationId: string,
    conversationId: string,
    actorId: string,
    dto: AssignConversationDto,
  ) {
    await this.prisma.conversationAssignment.updateMany({
      where: { conversationId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });

    await this.prisma.conversationAssignment.create({
      data: {
        organizationId,
        conversationId,
        assignedToId: dto.assignedToId,
        assignedById: actorId,
        assignmentType: "MANUAL",
      },
    });

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedAgentId: dto.assignedToId,
        assignedById: actorId,
        assignedAt: new Date(),
      },
      include: this.conversationInclude,
    });

    const payload = { ...conversation, tags: conversation.tags.map((t) => t.tag) };
    this.gateway.emitConversationAssigned(organizationId, payload);
    this.gateway.emitConversationUpdated(organizationId, payload);

    return payload;
  }

  async unassign(organizationId: string, conversationId: string, actorId: string) {
    await this.prisma.conversationAssignment.updateMany({
      where: { conversationId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedAgentId: null, assignedById: actorId, assignedAt: null },
      include: this.conversationInclude,
    });

    this.gateway.emitConversationUpdated(organizationId, {
      ...conversation,
      tags: conversation.tags.map((t) => t.tag),
    });

    return conversation;
  }

  async addTag(organizationId: string, conversationId: string, tagId: string) {
    await this.prisma.conversationTag.create({
      data: { organizationId, conversationId, tagId },
    });
    await this.search.updateConversationSearchText(organizationId, conversationId);
    return this.getOne(organizationId, conversationId);
  }

  async removeTag(organizationId: string, conversationId: string, tagId: string) {
    await this.prisma.conversationTag.deleteMany({
      where: { organizationId, conversationId, tagId },
    });
    await this.search.updateConversationSearchText(organizationId, conversationId);
    return this.getOne(organizationId, conversationId);
  }
}
