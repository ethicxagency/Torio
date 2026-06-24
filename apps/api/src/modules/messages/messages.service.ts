import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  ChannelType,
  MessageDirection,
  MessageSenderType,
  MessageStatus,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { InboxGateway } from "../inbox/inbox.gateway";
import { InboxSearchService } from "../inbox/inbox-search.service";
import { UsageService } from "../usage/usage.service";
import { MetaMessagingService } from "../webhooks/meta-messaging.service";
import { WhatsAppMessagingService } from "../webhooks/whatsapp-messaging.service";
import { SendMessageDto } from "./dto/message.dto";

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: InboxGateway,
    private search: InboxSearchService,
    private usage: UsageService,
    private meta: MetaMessagingService,
    private whatsapp: WhatsAppMessagingService,
  ) {}

  async list(organizationId: string, conversationId: string, cursor?: string) {
    const pageSize = 50;
    const messages = await this.prisma.message.findMany({
      where: { organizationId, conversationId, deletedAt: null },
      include: {
        agent: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > pageSize;
    const items = (hasMore ? messages.slice(0, pageSize) : messages).reverse();

    return {
      items,
      nextCursor: hasMore ? messages[pageSize - 1]?.id : null,
      hasMore,
    };
  }

  async send(
    organizationId: string,
    conversationId: string,
    agentId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId, deletedAt: null },
      include: {
        channel: { include: { connection: true } },
        customer: true,
      },
    });

    if (!conversation) throw new NotFoundException("Conversation not found");
    if (!conversation.channel.connection) {
      throw new BadRequestException("Channel not connected");
    }

    const message = await this.prisma.message.create({
      data: {
        organizationId,
        conversationId,
        agentId,
        direction: MessageDirection.OUTBOUND,
        senderType: MessageSenderType.AGENT,
        content: dto.content,
        contentType: dto.contentType ?? "TEXT" as const,
        status: MessageStatus.PENDING,
      },
      include: {
        agent: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
      },
    });

    try {
      const externalId = await this.dispatchOutbound(conversation, dto.content);
      const updated = await this.prisma.message.update({
        where: { id: message.id },
        data: {
          externalId,
          status: MessageStatus.SENT,
          sentAt: new Date(),
        },
        include: {
          agent: { select: { id: true, name: true, avatarUrl: true } },
          attachments: true,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: dto.content.slice(0, 200),
          status: "OPEN",
        },
      });

      await this.search.updateConversationSearchText(organizationId, conversationId);
      await this.usage.increment(organizationId, "MESSAGES");

      this.gateway.emitNewMessage(organizationId, conversationId, updated);
      this.gateway.emitConversationUpdated(
        organizationId,
        await this.getConversationSummary(conversationId),
      );

      return updated;
    } catch (error) {
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.FAILED },
      });
      throw error;
    }
  }

  private async dispatchOutbound(
    conversation: {
      channel: {
        type: ChannelType;
        connection: {
          accessToken: string;
          pageId: string | null;
          whatsappPhoneNumberId: string | null;
        } | null;
      };
      customer: {
        facebookId: string | null;
        instagramId: string | null;
        whatsappNumber: string | null;
      };
    },
    text: string,
  ): Promise<string> {
    const conn = conversation.channel.connection!;

    if (conversation.channel.type === ChannelType.WHATSAPP) {
      if (!conversation.customer.whatsappNumber || !conn.whatsappPhoneNumberId) {
        throw new BadRequestException("WhatsApp recipient not configured");
      }
      const result = await this.whatsapp.sendTextMessage(
        conn.whatsappPhoneNumberId,
        conn.accessToken,
        conversation.customer.whatsappNumber,
        text,
      );
      return result.messageId;
    }

    const recipientId =
      conversation.channel.type === ChannelType.INSTAGRAM
        ? conversation.customer.instagramId
        : conversation.customer.facebookId;

    if (!recipientId) throw new BadRequestException("Customer channel ID missing");

    const result = await this.meta.sendMessage(recipientId, text, conn.accessToken);
    return result.messageId;
  }

  private getConversationSummary(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        channel: { select: { id: true, type: true, name: true } },
        customer: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
        assignedAgent: { select: { id: true, name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
    });
  }
}
