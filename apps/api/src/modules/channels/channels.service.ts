import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChannelType, ChannelStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { MetaMessagingService } from "../webhooks/meta-messaging.service";
import { generateSecureToken, addDays } from "../../common/utils/crypto.util";
import {
  ConnectWhatsAppDto,
  SelectMetaPageDto,
} from "./dto/channel.dto";

interface MetaOAuthPagePayload {
  id: string;
  name: string;
  accessToken: string;
  instagramAccountId: string | null;
  instagramUsername: string | null;
}

interface MetaOAuthResultPayload {
  pages: MetaOAuthPagePayload[];
  tokenExpiresAt: string | null;
  channelType: ChannelType;
  userId: string;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private meta: MetaMessagingService,
    private auditLogs: AuditLogsService,
  ) {}

  list(organizationId: string) {
    return this.prisma.channel.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        connection: {
          select: {
            pageId: true,
            pageName: true,
            instagramAccountId: true,
            instagramUsername: true,
            whatsappPhoneNumber: true,
            whatsappPhoneNumberId: true,
            verificationStatus: true,
            webhookSubscribed: true,
            tokenExpiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async startMetaOAuth(
    organizationId: string,
    userId: string,
    channelType: ChannelType,
  ) {
    if (channelType !== ChannelType.MESSENGER && channelType !== ChannelType.INSTAGRAM) {
      throw new BadRequestException("Invalid channel type for Meta OAuth");
    }

    const state = generateSecureToken(16);
    await this.prisma.oAuthState.create({
      data: {
        organizationId,
        userId,
        provider: "meta",
        channelType,
        state,
        expiresAt: addDays(new Date(), 1),
      },
    });

    const scopes = [
      "pages_show_list",
      "pages_messaging",
      "pages_manage_metadata",
      "instagram_basic",
      "instagram_manage_messages",
      "business_management",
    ];

    return {
      url: this.meta.getOAuthUrl(state, scopes),
      state,
    };
  }

  async handleMetaCallback(code: string, state: string) {
    const oauthState = await this.prisma.oAuthState.findFirst({
      where: { state, expiresAt: { gt: new Date() } },
    });

    if (!oauthState) throw new BadRequestException("Invalid or expired OAuth state");

    const { accessToken: shortToken } = await this.meta.exchangeCode(code);
    const { accessToken, expiresIn } = await this.meta.getLongLivedToken(shortToken);
    const pages = await this.meta.getPages(accessToken);

    const pagesWithDetails = await Promise.all(
      pages.map(async (p) => {
        const ig = await this.meta.getInstagramAccount(p.id, p.access_token);
        return {
          id: p.id,
          name: p.name,
          accessToken: p.access_token,
          instagramAccountId: ig?.id ?? null,
          instagramUsername: ig?.username ?? null,
        };
      }),
    );

    const tokenExpiresAt = expiresIn
      ? addDays(new Date(), Math.floor(expiresIn / 86400)).toISOString()
      : null;

    const resultPayload: MetaOAuthResultPayload = {
      pages: pagesWithDetails,
      tokenExpiresAt,
      channelType: oauthState.channelType ?? ChannelType.MESSENGER,
      userId: oauthState.userId,
    };

    await this.prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { resultPayload: resultPayload as unknown as Prisma.InputJsonValue },
    });

    return {
      oauthState: state,
      organizationId: oauthState.organizationId,
      userId: oauthState.userId,
      channelType: oauthState.channelType,
      tokenExpiresAt,
      pages: pagesWithDetails.map((page) => ({
        id: page.id,
        name: page.name,
        instagramAccountId: page.instagramAccountId,
        instagramUsername: page.instagramUsername,
      })),
    };
  }

  async getMetaOAuthSession(organizationId: string, state: string) {
    const oauthState = await this.prisma.oAuthState.findFirst({
      where: { state, organizationId, expiresAt: { gt: new Date() } },
    });

    if (!oauthState?.resultPayload) {
      throw new BadRequestException("Invalid or expired OAuth session");
    }

    const payload = oauthState.resultPayload as unknown as MetaOAuthResultPayload;

    return {
      oauthState: state,
      organizationId: oauthState.organizationId,
      channelType: oauthState.channelType ?? ChannelType.MESSENGER,
      tokenExpiresAt: payload.tokenExpiresAt,
      pages: payload.pages.map((page) => ({
        id: page.id,
        name: page.name,
        instagramAccountId: page.instagramAccountId,
        instagramUsername: page.instagramUsername,
      })),
    };
  }

  private async resolveMetaOAuthPage(
    organizationId: string,
    oauthStateValue: string,
    pageId: string,
  ): Promise<{ page: MetaOAuthPagePayload; tokenExpiresAt: string | null }> {
    const oauthState = await this.prisma.oAuthState.findFirst({
      where: { state: oauthStateValue, organizationId, expiresAt: { gt: new Date() } },
    });

    if (!oauthState?.resultPayload) {
      throw new BadRequestException("Invalid or expired OAuth session");
    }

    const payload = oauthState.resultPayload as unknown as MetaOAuthResultPayload;
    const page = payload.pages.find((item) => item.id === pageId);

    if (!page) {
      throw new NotFoundException("Page not found in OAuth session");
    }

    if (!page.accessToken?.trim()) {
      throw new BadRequestException("Selected page is missing a valid access token");
    }

    return { page, tokenExpiresAt: payload.tokenExpiresAt };
  }

  async connectMetaPage(
    organizationId: string,
    userId: string,
    dto: SelectMetaPageDto,
  ) {
    let page: MetaOAuthPagePayload;
    let tokenExpiresAt: string | null = dto.tokenExpiresAt ?? null;

    if (dto.oauthState) {
      const resolved = await this.resolveMetaOAuthPage(organizationId, dto.oauthState, dto.pageId);
      page = resolved.page;
      tokenExpiresAt = resolved.tokenExpiresAt;
    } else {
      const selected = dto.pages?.find((item) => item.id === dto.pageId);
      if (!selected?.accessToken?.trim()) {
        throw new BadRequestException(
          "Missing OAuth session. Reconnect Facebook and try again.",
        );
      }
      page = {
        id: selected.id,
        name: selected.name,
        accessToken: selected.accessToken,
        instagramAccountId: null,
        instagramUsername: null,
      };
    }

    const channelType = dto.channelType ?? ChannelType.MESSENGER;
    const subscribed = await this.meta.subscribePageWebhooks(page.id, page.accessToken);
    if (!subscribed) {
      this.logger.warn(`Meta webhook subscription failed for page ${page.id}`);
    }

    let channel = await this.prisma.channel.findFirst({
      where: {
        organizationId,
        type: channelType,
        externalId: page.id,
        deletedAt: null,
      },
    });

    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          organizationId,
          type: channelType,
          name: page.name,
          externalId: page.id,
          status: ChannelStatus.CONNECTED,
          accessToken: page.accessToken,
          tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        },
      });
    } else {
      channel = await this.prisma.channel.update({
        where: { id: channel.id },
        data: {
          status: ChannelStatus.CONNECTED,
          accessToken: page.accessToken,
          name: page.name,
          tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        },
      });
    }

    await this.prisma.channelConnection.upsert({
      where: { channelId: channel.id },
      create: {
        organizationId,
        channelId: channel.id,
        pageId: page.id,
        pageName: page.name,
        accessToken: page.accessToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        verificationStatus: "verified",
        webhookSubscribed: subscribed,
      },
      update: {
        pageId: page.id,
        pageName: page.name,
        accessToken: page.accessToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        verificationStatus: "verified",
        webhookSubscribed: subscribed,
      },
    });

    if (dto.connectInstagram) {
      const ig = await this.meta.getInstagramAccount(page.id, page.accessToken);
      if (ig) {
        await this.connectInstagramAccount(organizationId, userId, page, ig, tokenExpiresAt ?? undefined);
      }
    }

    if (dto.oauthState) {
      await this.prisma.oAuthState.deleteMany({
        where: { state: dto.oauthState, organizationId },
      });
    }

    await this.auditLogs.create({
      action: "CHANNEL_CONNECTED",
      organizationId,
      userId,
      resource: "channel",
      resourceId: channel.id,
      metadata: { type: channelType, pageId: page.id },
    });

    return channel;
  }

  private async connectInstagramAccount(
    organizationId: string,
    userId: string,
    page: { id: string; name: string; accessToken: string },
    ig: { id: string; username?: string },
    tokenExpiresAt?: string,
  ) {
    let channel = await this.prisma.channel.findFirst({
      where: { organizationId, type: ChannelType.INSTAGRAM, externalId: ig.id, deletedAt: null },
    });

    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          organizationId,
          type: ChannelType.INSTAGRAM,
          name: ig.username ?? `Instagram ${ig.id}`,
          externalId: ig.id,
          status: ChannelStatus.CONNECTED,
          accessToken: page.accessToken,
        },
      });
    }

    await this.prisma.channelConnection.upsert({
      where: { channelId: channel.id },
      create: {
        organizationId,
        channelId: channel.id,
        pageId: page.id,
        pageName: page.name,
        instagramAccountId: ig.id,
        instagramUsername: ig.username,
        accessToken: page.accessToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        verificationStatus: "verified",
        webhookSubscribed: true,
      },
      update: {
        instagramAccountId: ig.id,
        instagramUsername: ig.username,
        accessToken: page.accessToken,
        verificationStatus: "verified",
      },
    });

    await this.auditLogs.create({
      action: "CHANNEL_CONNECTED",
      organizationId,
      userId,
      resource: "channel",
      resourceId: channel.id,
      metadata: { type: ChannelType.INSTAGRAM, instagramId: ig.id },
    });
  }

  async connectWhatsApp(organizationId: string, userId: string, dto: ConnectWhatsAppDto) {
    let channel = await this.prisma.channel.findFirst({
      where: {
        organizationId,
        type: ChannelType.WHATSAPP,
        externalId: dto.phoneNumberId,
        deletedAt: null,
      },
    });

    if (!channel) {
      channel = await this.prisma.channel.create({
        data: {
          organizationId,
          type: ChannelType.WHATSAPP,
          name: dto.displayName ?? dto.phoneNumber,
          externalId: dto.phoneNumberId,
          status: ChannelStatus.CONNECTED,
          accessToken: dto.accessToken,
        },
      });
    } else {
      channel = await this.prisma.channel.update({
        where: { id: channel.id },
        data: { status: ChannelStatus.CONNECTED, accessToken: dto.accessToken },
      });
    }

    await this.prisma.channelConnection.upsert({
      where: { channelId: channel.id },
      create: {
        organizationId,
        channelId: channel.id,
        whatsappBusinessAccountId: dto.businessAccountId,
        whatsappPhoneNumber: dto.phoneNumber,
        whatsappPhoneNumberId: dto.phoneNumberId,
        accessToken: dto.accessToken,
        verificationStatus: "verified",
        webhookSubscribed: true,
      },
      update: {
        whatsappBusinessAccountId: dto.businessAccountId,
        whatsappPhoneNumber: dto.phoneNumber,
        whatsappPhoneNumberId: dto.phoneNumberId,
        accessToken: dto.accessToken,
        verificationStatus: "verified",
      },
    });

    await this.auditLogs.create({
      action: "CHANNEL_CONNECTED",
      organizationId,
      userId,
      resource: "channel",
      resourceId: channel.id,
      metadata: { type: ChannelType.WHATSAPP },
    });

    return channel;
  }

  async disconnect(organizationId: string, userId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId, deletedAt: null },
    });
    if (!channel) throw new NotFoundException("Channel not found");

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { status: ChannelStatus.DISCONNECTED, deletedAt: new Date() },
    });

    await this.auditLogs.create({
      action: "CHANNEL_DISCONNECTED",
      organizationId,
      userId,
      resource: "channel",
      resourceId: channelId,
    });

    return { success: true };
  }

  async syncHistory(organizationId: string, channelId: string, customerExternalId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId, deletedAt: null },
      include: { connection: true },
    });
    if (!channel?.connection) throw new NotFoundException("Channel not connected");

    const history = await this.meta.syncConversationHistory(
      channel.connection.pageId!,
      channel.connection.accessToken,
      customerExternalId,
    );

    return { synced: history.length, messages: history };
  }

  async checkTokenHealth(organizationId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId, deletedAt: null },
      include: { connection: true },
    });

    if (!channel) throw new NotFoundException("Channel not found");

    const storedToken = channel.connection?.accessToken ?? channel.accessToken;
    const storedExpiresAt =
      channel.connection?.tokenExpiresAt ?? channel.tokenExpiresAt ?? null;

    if (!storedToken?.trim()) {
      return {
        channelId: channel.id,
        channelType: channel.type,
        status: "missing" as const,
        valid: false,
        storedExpiresAt,
        webhookSubscribed: channel.connection?.webhookSubscribed ?? false,
        message: "No Meta access token stored for this channel",
      };
    }

    const debug = await this.meta.debugToken(storedToken);
    const now = new Date();
    const graphExpiresAt = debug.expiresAt ? new Date(debug.expiresAt) : null;
    const isExpiredByStoredDate = storedExpiresAt ? storedExpiresAt <= now : false;
    const isExpiredByGraph = graphExpiresAt ? graphExpiresAt <= now : false;

    let status: "valid" | "invalid" | "expired" | "missing" = "valid";
    if (!debug.isValid) {
      status = debug.error?.message.toLowerCase().includes("expired") ? "expired" : "invalid";
    } else if (isExpiredByStoredDate || isExpiredByGraph) {
      status = "expired";
    }

    return {
      channelId: channel.id,
      channelType: channel.type,
      status,
      valid: debug.isValid && status === "valid",
      storedExpiresAt,
      graphExpiresAt: debug.expiresAt ?? null,
      tokenType: debug.type ?? null,
      scopes: debug.scopes ?? [],
      webhookSubscribed: channel.connection?.webhookSubscribed ?? false,
      pageId: channel.connection?.pageId ?? null,
      instagramAccountId: channel.connection?.instagramAccountId ?? null,
      error: debug.error ?? null,
    };
  }
}
