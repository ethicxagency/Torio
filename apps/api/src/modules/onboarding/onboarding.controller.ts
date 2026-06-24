import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import {
  BusinessInfoStepDto,
  KnowledgeStepDto,
  InviteTeamStepDto,
} from "./dto/onboarding.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CurrentTenant,
  CurrentUser,
  OrganizationId,
} from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { RequestUser, RequestTenant } from "../../common/decorators/current-user.decorator";

@Controller("onboarding")
@UseGuards(JwtAuthGuard, TenantGuard)
export class OnboardingController {
  constructor(private service: OnboardingService) {}

  @Get("status")
  @RequirePermissions(PERMISSIONS.ORG_READ)
  status(@OrganizationId() organizationId: string) {
    return this.service.getStatus(organizationId);
  }

  @Post("business-info")
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  businessInfo(@OrganizationId() organizationId: string, @Body() dto: BusinessInfoStepDto) {
    return this.service.saveBusinessInfo(organizationId, dto);
  }

  @Post("channels/complete")
  @RequirePermissions(PERMISSIONS.CHANNELS_MANAGE)
  completeChannels(@OrganizationId() organizationId: string) {
    return this.service.completeChannelsStep(organizationId);
  }

  @Post("knowledge")
  @RequirePermissions(PERMISSIONS.KNOWLEDGE_MANAGE)
  knowledge(@OrganizationId() organizationId: string, @Body() dto: KnowledgeStepDto) {
    return this.service.saveKnowledge(organizationId, dto);
  }

  @Post("invite-team")
  @RequirePermissions(PERMISSIONS.TEAM_INVITE)
  inviteTeam(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @CurrentTenant() tenant: RequestTenant,
    @Body() dto: InviteTeamStepDto,
  ) {
    return this.service.inviteTeam(
      organizationId,
      user.id,
      dto,
      tenant.role as "OWNER" | "ADMIN" | "AGENT",
    );
  }

  @Post("complete")
  @RequirePermissions(PERMISSIONS.ORG_UPDATE)
  complete(@OrganizationId() organizationId: string) {
    return this.service.complete(organizationId);
  }
}
