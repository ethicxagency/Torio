import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ChannelType,
  MessageContentType,
  MessageDirection,
  MessageSenderType,
  MessageStatus,
} from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { InboxGateway } from "../inbox/inbox.gateway";
import { InboxSearchService } from "../inbox/inbox-search.service";
import { UsageService } from "../usage/usage.service";
import { getMetaWebhookUrl } from "../../common/config/app-env";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: InboxGateway,
    private search: InboxSearchService,
    private usage: UsageService,
    private config: ConfigService,
  ) {}

  getConfiguredWebhookUrls() {
    return {
      meta: getMetaWebhookUrl("meta"),
      whatsapp: getMetaWebhookUrl("whatsapp"),
    };
  }

  verifyMetaToken(mode: string, token: string, challenge: string) {
    const configured = this.config.get<string>("META_WEBHOOK_VERIFY_TOKEN")?.trim();
    const isProduction = this.config.get<string>("NODE_ENV") === "production";

    if (isProduction && !configured) {
      this.logger.error("Meta webhook verification rejected: META_WEBHOOK_VERIFY_TOKEN is required in production");
      return null;
    }

    const verifyToken = configured || "mango_webhook_verify";
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    if (mode === "subscribe") {
      this.logger.warn(
        `Meta webhook verification failed: verify token mismatch (configured=${configured ? "yes" : "default"})`,
      );
    }
    return null;
  }

  verifyWhatsAppToken(mode: string, token: string, challenge: string) {
    return this.verifyMetaToken(mode, token, challenge);
  }

  async handleMetaWebhook(body: Record<string, unknown>) {
    const object = body.object as string;
    if (object === "page") {
      await this.processMessengerEntries(body.entry as MetaEntry[]);
    } else if (object === "instagram") {
      await this.processInstagramEntries(body.entry as MetaEntry[]);
    }
    return { success: true };
  }

  async handleWhatsAppWebhook(body: Record<string, unknown>) {
    const entries = body.entry as WhatsAppEntry[] | undefined;
    if (!entries?.length) return { success: true };

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const connection = await this.prisma.channelConnection.findFirst({
          where: { whatsappPhoneNumberId: phoneNumberId },
          include: { channel: true },
        });
        if (!connection) continue;

        for (const msg of value.messages ?? []) {
          await this.handleWhatsAppInbound(connection.organizationId, connection.channel, msg, value.contacts);
        }

        for (const status of value.statuses ?? []) {
          await this.handleWhatsAppStatus(connection.organizationId, status);
        }
      }
    }

    return { success: true };
  }

  private async processMessengerEntries(entries: MetaEntry[] = []) {
    for (const entry of entries) {
      const pageId = entry.id;
      const connection = await this.prisma.channelConnection.findFirst({
        where: { pageId },
        include: { channel: true },
      });
      if (!connection) continue;

      for (const event of entry.messaging ?? []) {
        if (event.message) {
          await this.handleMetaInbound(
            connection.organizationId,
            connection.channel,
            ChannelType.MESSENGER,
            event.sender.id,
            event.message,
          );
        }
      }
    }
  }

  private async processInstagramEntries(entries: MetaEntry[] = []) {
    for (const entry of entries) {
      for (const event of entry.messaging ?? []) {
        const igAccountId = entry.id;
        const connection = await this.prisma.channelConnection.findFirst({
          where: { instagramAccountId: igAccountId },
          include: { channel: true },
        });
        if (!connection || !event.message) continue;

        await this.handleMetaInbound(
          connection.organizationId,
          connection.channel,
          ChannelType.INSTAGRAM,
          event.sender.id,
          event.message,
        );
      }
    }
  }

  private async handleMetaInbound(
    organizationId: string,
    channel: { id: string; type: ChannelType },
    channelType: ChannelType,
    senderId: string,
    message: MetaMessage,
  ) {
    const existing = await this.prisma.message.findFirst({
      where: { organizationId, externalId: message.mid },
    });
    if (existing) return;

    const customer = await this.findOrCreateCustomer(organizationId, channelType, senderId);
    const conversation = await this.findOrCreateConversation(
      organizationId,
      channel.id,
      customer.id,
    );

    const contentType = this.resolveContentType(message);
    const content = message.text ?? message.sticker_id ?? "[Attachment]";

    const saved = await this.prisma.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        senderType: MessageSenderType.CUSTOMER,
        content,
        contentType,
        status: MessageStatus.DELIVERED,
        externalId: message.mid,
        deliveredAt: new Date(),
        attachments: message.attachments?.length
          ? {
              create: message.attachments.map((a, i) => ({
                organizationId,
                url: a.payload?.url ?? "",
                mimeType: a.type ?? "file",
                fileName: `attachment-${i + 1}`,
              })),
            }
          : undefined,
      },
      include: this.messageInclude(),
    });

    await this.afterInboundMessage(organizationId, conversation.id, customer.id, saved);
  }

  private async handleWhatsAppInbound(
    organizationId: string,
    channel: { id: string },
    msg: WhatsAppMessage,
    contacts?: WhatsAppContact[],
  ) {
    const existing = await this.prisma.message.findFirst({
      where: { organizationId, externalId: msg.id },
    });
    if (existing) return;

    const contact = contacts?.find((c) => c.wa_id === msg.from);
    let customer = await this.prisma.customer.findFirst({
      where: { organizationId, whatsappNumber: msg.from },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId,
          whatsappNumber: msg.from,
          fullName: contact?.profile?.name,
          firstContactAt: new Date(),
          lastContactAt: new Date(),
        },
      });
    } else {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          lastContactAt: new Date(),
          fullName: contact?.profile?.name ?? customer.fullName,
        },
      });
    }

    const conversation = await this.findOrCreateConversation(
      organizationId,
      channel.id,
      customer.id,
    );

    const { content, contentType } = this.parseWhatsAppMessage(msg);

    const saved = await this.prisma.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        direction: MessageDirection.INBOUND,
        senderType: MessageSenderType.CUSTOMER,
        content,
        contentType,
        status: MessageStatus.DELIVERED,
        externalId: msg.id,
        deliveredAt: new Date(),
      },
      include: this.messageInclude(),
    });

    await this.afterInboundMessage(organizationId, conversation.id, customer.id, saved);
  }

  private async handleWhatsAppStatus(
    organizationId: string,
    status: WhatsAppStatus,
  ) {
    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    const message = await this.prisma.message.findFirst({
      where: { organizationId, externalId: status.id },
    });
    if (!message) return;

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: {
        status: statusMap[status.status] ?? message.status,
        sentAt: status.status === "sent" ? new Date(parseInt(status.timestamp) * 1000) : message.sentAt,
        deliveredAt:
          status.status === "delivered"
            ? new Date(parseInt(status.timestamp) * 1000)
            : message.deliveredAt,
        readAt:
          status.status === "read"
            ? new Date(parseInt(status.timestamp) * 1000)
            : message.readAt,
      },
    });

    this.gateway.emitMessageStatus(organizationId, message.conversationId, {
      messageId: updated.id,
      status: updated.status,
    });
  }

  private async findOrCreateCustomer(
    organizationId: string,
    channelType: ChannelType,
    externalId: string,
  ) {
    const where =
      channelType === ChannelType.MESSENGER
        ? { organizationId, facebookId: externalId }
        : channelType === ChannelType.INSTAGRAM
          ? { organizationId, instagramId: externalId }
          : { organizationId, whatsappNumber: externalId };

    let customer = await this.prisma.customer.findFirst({ where });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId,
          ...(channelType === ChannelType.MESSENGER && { facebookId: externalId }),
          ...(channelType === ChannelType.INSTAGRAM && { instagramId: externalId }),
          ...(channelType === ChannelType.WHATSAPP && { whatsappNumber: externalId }),
          firstContactAt: new Date(),
          lastContactAt: new Date(),
        },
      });
    } else {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { lastContactAt: new Date() },
      });
    }

    return customer;
  }

  private async findOrCreateConversation(
    organizationId: string,
    channelId: string,
    customerId: string,
  ) {
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId,
        channelId,
        customerId,
        status: { in: ["OPEN", "PENDING"] },
        deletedAt: null,
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { organizationId, channelId, customerId },
      });
    }

    return conversation;
  }

  private async afterInboundMessage(
    organizationId: string,
    conversationId: string,
    customerId: string,
    message: Awaited<ReturnType<typeof this.prisma.message.create>>,
  ) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: message.content.slice(0, 200),
        unreadCount: { increment: 1 },
        status: "OPEN",
      },
    });

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { lastContactAt: new Date() },
    });

    await this.search.updateConversationSearchText(organizationId, conversationId);
    await this.usage.increment(organizationId, "MESSAGES");

    const full = await this.prisma.message.findUnique({
      where: { id: message.id },
      include: this.messageInclude(),
    });

    this.gateway.emitNewMessage(organizationId, conversationId, full);
    this.gateway.emitConversationUpdated(organizationId, await this.getConversationSummary(conversationId));
  }

  private async getConversationSummary(conversationId: string) {
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

  private messageInclude() {
    return {
      agent: { select: { id: true, name: true, avatarUrl: true } },
      attachments: true,
    };
  }

  private resolveContentType(message: MetaMessage): MessageContentType {
    if (message.attachments?.[0]?.type === "image") return MessageContentType.IMAGE;
    if (message.attachments?.[0]?.type === "video") return MessageContentType.VIDEO;
    if (message.attachments?.[0]?.type === "audio") return MessageContentType.AUDIO;
    if (message.attachments?.[0]?.type === "file") return MessageContentType.DOCUMENT;
    return MessageContentType.TEXT;
  }

  private parseWhatsAppMessage(msg: WhatsAppMessage): {
    content: string;
    contentType: MessageContentType;
  } {
    switch (msg.type) {
      case "text":
        return { content: msg.text?.body ?? "", contentType: MessageContentType.TEXT };
      case "image":
        return { content: msg.image?.caption ?? "[Image]", contentType: MessageContentType.IMAGE };
      case "video":
        return { content: msg.video?.caption ?? "[Video]", contentType: MessageContentType.VIDEO };
      case "audio":
        return { content: "[Audio]", contentType: MessageContentType.AUDIO };
      case "document":
        return {
          content: msg.document?.filename ?? "[Document]",
          contentType: MessageContentType.DOCUMENT,
        };
      default:
        return { content: `[${msg.type}]`, contentType: MessageContentType.TEXT };
    }
  }
}

interface MetaEntry {
  id: string;
  messaging?: MetaMessagingEvent[];
}

interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  message?: MetaMessage;
}

interface MetaMessage {
  mid: string;
  text?: string;
  sticker_id?: string;
  attachments?: { type: string; payload?: { url?: string } }[];
}

interface WhatsAppEntry {
  changes?: { field: string; value: WhatsAppChangeValue }[];
}

interface WhatsAppChangeValue {
  metadata?: { phone_number_id: string };
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  contacts?: WhatsAppContact[];
}

interface WhatsAppMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { filename?: string };
}

interface WhatsAppStatus {
  id: string;
  status: string;
  timestamp: string;
}

interface WhatsAppContact {
  wa_id: string;
  profile?: { name?: string };
}
