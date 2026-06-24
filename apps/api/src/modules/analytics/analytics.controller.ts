import { Controller, Get, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";

@Controller("analytics")
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.ANALYTICS_READ)
  dashboard(@OrganizationId() organizationId: string) {
    return this.service.getDashboard(organizationId);
  }

  @Get("team-performance")
  @RequirePermissions(PERMISSIONS.ANALYTICS_READ)
  teamPerformance(@OrganizationId() organizationId: string) {
    return this.service.getTeamPerformance(organizationId);
  }

  @Get("channels")
  @RequirePermissions(PERMISSIONS.ANALYTICS_READ)
  channelAccounts(@OrganizationId() organizationId: string) {
    return this.service.getChannelAccounts(organizationId);
  }
}
