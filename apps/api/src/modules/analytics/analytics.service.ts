import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { startOfMonth, endOfMonth } from "../../common/utils/crypto.util";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(organizationId: string) {
    const periodStart = startOfMonth();
    const periodEnd = endOfMonth();

    const [
      totalConversations,
      openConversations,
      closedConversations,
      pendingConversations,
      activeAgents,
      assignedConversations,
      messengerMessages,
      instagramMessages,
      whatsappMessages,
      aiReplies,
      humanReplies,
      aiEscalated,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { organizationId, deletedAt: null, createdAt: { gte: periodStart, lte: periodEnd } },
      }),
      this.prisma.conversation.count({
        where: { organizationId, status: "OPEN", deletedAt: null },
      }),
      this.prisma.conversation.count({
        where: { organizationId, status: "CLOSED", deletedAt: null },
      }),
      this.prisma.conversation.count({
        where: { organizationId, status: "PENDING", deletedAt: null },
      }),
      this.prisma.membership.count({
        where: { organizationId, isActive: true, role: "AGENT", deletedAt: null },
      }),
      this.prisma.conversation.count({
        where: { organizationId, assignedAgentId: { not: null }, status: "OPEN", deletedAt: null },
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: periodStart, lte: periodEnd },
          conversation: { channel: { type: "MESSENGER" } },
        },
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: periodStart, lte: periodEnd },
          conversation: { channel: { type: "INSTAGRAM" } },
        },
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: periodStart, lte: periodEnd },
          conversation: { channel: { type: "WHATSAPP" } },
        },
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          senderType: "AI",
          deletedAt: null,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          senderType: "AGENT",
          deletedAt: null,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
      this.prisma.aiLog.count({
        where: {
          organizationId,
          wasEscalated: true,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      }),
    ]);

    const totalAiInteractions = aiReplies + aiEscalated;
    const aiResolutionRate =
      totalAiInteractions > 0
        ? Math.round(((aiReplies - aiEscalated) / totalAiInteractions) * 100)
        : 0;

    return {
      period: { start: periodStart, end: periodEnd },
      conversations: {
        total: totalConversations,
        open: openConversations,
        closed: closedConversations,
        pending: pendingConversations,
      },
      team: {
        activeAgents,
        assignedConversations,
      },
      channels: {
        messenger: messengerMessages,
        instagram: instagramMessages,
        whatsapp: whatsappMessages,
      },
      ai: {
        aiReplies,
        humanReplies,
        aiResolutionRate: Math.max(0, aiResolutionRate),
      },
    };
  }

  async getTeamPerformance(organizationId: string) {
    const periodStart = startOfMonth();
    const periodEnd = endOfMonth();

    const members = await this.prisma.membership.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    const performance = await Promise.all(
      members.map(async (m) => {
        const [assigned, closed, customersAssigned] = await Promise.all([
          this.prisma.conversation.count({
            where: {
              organizationId,
              assignedAgentId: m.userId,
              deletedAt: null,
              createdAt: { gte: periodStart, lte: periodEnd },
            },
          }),
          this.prisma.conversation.count({
            where: {
              organizationId,
              assignedAgentId: m.userId,
              status: "CLOSED",
              deletedAt: null,
              closedAt: { gte: periodStart, lte: periodEnd },
            },
          }),
          this.prisma.customer.count({
            where: { organizationId, assignedAgentId: m.userId, deletedAt: null },
          }),
        ]);

        return {
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          assignedConversations: assigned,
          closedConversations: closed,
          assignedCustomers: customersAssigned,
          avgResponseTimeMinutes: null,
          satisfactionScore: null,
        };
      }),
    );

    return { period: { start: periodStart, end: periodEnd }, agents: performance };
  }

  async getChannelAccounts(organizationId: string) {
    const periodStart = startOfMonth();
    const periodEnd = endOfMonth();

    const channels = await this.prisma.channel.findMany({
      where: { organizationId, deletedAt: null, status: "CONNECTED" },
      include: {
        connection: {
          select: {
            pageId: true,
            pageName: true,
            instagramAccountId: true,
            instagramUsername: true,
            whatsappPhoneNumber: true,
            whatsappPhoneNumberId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const accounts = await Promise.all(
      channels.map(async (channel) => {
        const [messageCount, conversationCount, openConversations] = await Promise.all([
          this.prisma.message.count({
            where: {
              organizationId,
              deletedAt: null,
              createdAt: { gte: periodStart, lte: periodEnd },
              conversation: { channelId: channel.id },
            },
          }),
          this.prisma.conversation.count({
            where: {
              organizationId,
              deletedAt: null,
              channelId: channel.id,
              createdAt: { gte: periodStart, lte: periodEnd },
            },
          }),
          this.prisma.conversation.count({
            where: {
              organizationId,
              deletedAt: null,
              channelId: channel.id,
              status: "OPEN",
            },
          }),
        ]);

        const accountName =
          channel.type === "MESSENGER"
            ? channel.connection?.pageName ?? channel.name
            : channel.type === "INSTAGRAM"
              ? channel.connection?.instagramUsername
                ? `@${channel.connection.instagramUsername}`
                : channel.name
              : channel.connection?.whatsappPhoneNumber ?? channel.name;

        const accountId =
          channel.type === "MESSENGER"
            ? channel.connection?.pageId ?? channel.externalId
            : channel.type === "INSTAGRAM"
              ? channel.connection?.instagramAccountId ?? channel.externalId
              : channel.connection?.whatsappPhoneNumberId ??
                channel.connection?.whatsappPhoneNumber ??
                channel.externalId;

        return {
          channelId: channel.id,
          type: channel.type,
          name: accountName,
          accountId,
          status: channel.status,
          connectedAt: channel.createdAt,
          messageCount,
          conversationCount,
          openConversations,
          avgResponseTimeMinutes: null,
        };
      }),
    );

    const byType = {
      messenger: accounts.filter((a) => a.type === "MESSENGER"),
      instagram: accounts.filter((a) => a.type === "INSTAGRAM"),
      whatsapp: accounts.filter((a) => a.type === "WHATSAPP"),
    };

    const topPerforming = [...accounts]
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 5);

    return {
      period: { start: periodStart, end: periodEnd },
      accounts,
      byType,
      topPerforming,
    };
  }
}
