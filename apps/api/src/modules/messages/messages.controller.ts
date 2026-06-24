import { Controller, Get, Param, Post, Body, Query, UseGuards } from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentUser, OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import { SendMessageDto, ListMessagesDto } from "./dto/message.dto";

@Controller("conversations/:conversationId/messages")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagesController {
  constructor(private service: MessagesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  list(
    @OrganizationId() organizationId: string,
    @Param("conversationId") conversationId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.service.list(organizationId, conversationId, query.cursor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.INBOX_REPLY)
  send(
    @OrganizationId() organizationId: string,
    @Param("conversationId") conversationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.send(organizationId, conversationId, user.id, dto);
  }
}
