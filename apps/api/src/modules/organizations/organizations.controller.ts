import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { UpdateOrganizationDto } from "./dto/organization.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CurrentUser,
  OrganizationId,
} from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { RequestUser } from "../../common/decorators/current-user.decorator";

@Controller("organizations")
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Get("current")
  @RequirePermissions(PERMISSIONS.ORG_READ)
  getCurrent(@OrganizationId() organizationId: string) {
    return this.service.findOne(organizationId);
  }

  @Patch("current")
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  update(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.service.update(organizationId, dto, user.id);
  }
}
