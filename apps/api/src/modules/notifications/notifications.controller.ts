import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CurrentUser,
  OrganizationId,
} from "../../common/decorators/current-user.decorator";
import { RequestUser } from "../../common/decorators/current-user.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard, TenantGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  list(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Query("page") page?: string,
  ) {
    return this.service.listForUser(
      organizationId,
      user.id,
      page ? parseInt(page, 10) : 1,
    );
  }

  @Patch("read-all")
  markAllRead(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.markAllRead(organizationId, user.id);
  }

  @Patch(":id/read")
  markRead(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.service.markRead(organizationId, user.id, id);
  }
}
