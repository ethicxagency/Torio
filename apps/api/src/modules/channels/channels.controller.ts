import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChannelsService } from "./channels.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CurrentUser,
  OrganizationId,
} from "../../common/decorators/current-user.decorator";
import { RequirePermissions, Public } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import {
  ConnectWhatsAppDto,
  SelectMetaPageDto,
  StartOAuthDto,
} from "./dto/channel.dto";
import { ConfigService } from "@nestjs/config";

@Controller("channels")
export class ChannelsController {
  constructor(
    private service: ChannelsService,
    private config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_READ)
  list(@OrganizationId() organizationId: string) {
    return this.service.list(organizationId);
  }

  @Post("meta/oauth/start")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  startMetaOAuth(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: StartOAuthDto,
  ) {
    return this.service.startMetaOAuth(organizationId, user.id, dto.channelType);
  }

  @Get("meta/oauth/session")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  getMetaOAuthSession(
    @OrganizationId() organizationId: string,
    @Query("state") state: string,
  ) {
    return this.service.getMetaOAuthSession(organizationId, state);
  }

  @Public()
  @Get("meta/callback")
  async metaCallback(@Query("code") code: string, @Query("state") state: string) {
    const result = await this.service.handleMetaCallback(code, state);
    const webUrl = this.config.get<string>("WEB_URL") ?? "http://localhost:3010";
    const targetOrigin = JSON.stringify(webUrl);
    const pagesParam = encodeURIComponent(JSON.stringify(result.pages));
    const payload = JSON.stringify({
      type: "META_OAUTH",
      oauthState: result.oauthState,
      pages: result.pages,
      organizationId: result.organizationId,
      channelType: result.channelType,
      tokenExpiresAt: result.tokenExpiresAt ?? "",
    });
    const redirectUrl = `${webUrl}/settings/channels?oauth=meta&oauthState=${encodeURIComponent(result.oauthState)}&pages=${pagesParam}&channelType=${result.channelType}&tokenExpiresAt=${encodeURIComponent(result.tokenExpiresAt ?? "")}`;
    return `<html><body><script>
      (function () {
        var payload = ${payload};
        if (window.opener) {
          window.opener.postMessage(payload, ${targetOrigin});
          window.close();
        }
        if (!window.closed) {
          window.location.href = ${JSON.stringify(redirectUrl)};
        }
      })();
    </script>Redirecting...</body></html>`;
  }

  @Post("meta/connect")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  connectMeta(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SelectMetaPageDto,
  ) {
    return this.service.connectMetaPage(organizationId, user.id, dto);
  }

  @Get(":channelId/token-health")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_READ)
  tokenHealth(
    @OrganizationId() organizationId: string,
    @Param("channelId") channelId: string,
  ) {
    return this.service.checkTokenHealth(organizationId, channelId);
  }

  @Post("whatsapp/connect")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  connectWhatsApp(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ConnectWhatsAppDto,
  ) {
    return this.service.connectWhatsApp(organizationId, user.id, dto);
  }

  @Delete(":channelId")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  disconnect(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Param("channelId") channelId: string,
  ) {
    return this.service.disconnect(organizationId, user.id, channelId);
  }

  @Post(":channelId/sync")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  syncHistory(
    @OrganizationId() organizationId: string,
    @Param("channelId") channelId: string,
    @Body() body: { customerExternalId: string },
  ) {
    return this.service.syncHistory(organizationId, channelId, body.customerExternalId);
  }
}
