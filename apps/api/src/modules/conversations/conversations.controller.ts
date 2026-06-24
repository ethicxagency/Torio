import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CurrentUser,
  OrganizationId,
} from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { RequestUser } from "../../common/decorators/current-user.decorator";
import {
  AssignConversationDto,
  ListConversationsDto,
  UpdateConversationStatusDto,
} from "./dto/conversation.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard, TenantGuard)
export class ConversationsController {
  constructor(private service: ConversationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Query() query: ListConversationsDto,
  ) {
    return this.service.list(organizationId, user.id, query);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.getOne(organizationId, id);
  }

  @Patch(":id/read")
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  markRead(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.markRead(organizationId, id);
  }

  @Patch(":id/status")
  @RequirePermissions(PERMISSIONS.INBOX_CLOSE)
  updateStatus(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateConversationStatusDto,
  ) {
    return this.service.updateStatus(organizationId, id, dto.status);
  }

  @Post(":id/assign")
  @RequirePermissions(PERMISSIONS.INBOX_ASSIGN)
  assign(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: AssignConversationDto,
  ) {
    return this.service.assign(organizationId, id, user.id, dto);
  }

  @Post(":id/unassign")
  @RequirePermissions(PERMISSIONS.INBOX_ASSIGN)
  unassign(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.unassign(organizationId, id, user.id);
  }

  @Post(":id/tags/:tagId")
  @RequirePermissions(PERMISSIONS.TAGS_MANAGE)
  addTag(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    return this.service.addTag(organizationId, id, tagId);
  }

  @Delete(":id/tags/:tagId")
  @RequirePermissions(PERMISSIONS.TAGS_MANAGE)
  removeTag(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
  ) {
    return this.service.removeTag(organizationId, id, tagId);
  }
}
