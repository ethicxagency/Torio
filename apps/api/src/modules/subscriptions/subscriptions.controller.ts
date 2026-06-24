import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { SubscriptionsService } from "./subscriptions.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { IsString } from "class-validator";

class ChangePlanDto {
  @IsString()
  planSlug!: string;
}

@Controller("subscriptions")
@UseGuards(JwtAuthGuard, TenantGuard)
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}

  @Get("current")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  current(@OrganizationId() organizationId: string) {
    return this.service.getCurrent(organizationId);
  }

  @Patch("change-plan")
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  changePlan(@OrganizationId() organizationId: string, @Body() dto: ChangePlanDto) {
    return this.service.changePlan(organizationId, dto.planSlug);
  }
}
