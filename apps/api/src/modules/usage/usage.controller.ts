import { Controller, Get, UseGuards } from "@nestjs/common";
import { UsageService } from "./usage.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";

@Controller("usage")
@UseGuards(JwtAuthGuard, TenantGuard)
export class UsageController {
  constructor(private service: UsageService) {}

  @Get("current")
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  current(@OrganizationId() organizationId: string) {
    return this.service.getCurrentPeriod(organizationId);
  }
}
