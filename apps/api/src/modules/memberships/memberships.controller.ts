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
import { MembershipsService } from "./memberships.service";
import { InviteMemberDto, UpdateMemberRoleDto } from "./dto/membership.dto";
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

@Controller("team")
@UseGuards(JwtAuthGuard, TenantGuard)
export class MembershipsController {
  constructor(private service: MembershipsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TEAM_READ)
  list(@OrganizationId() organizationId: string, @Query("includeInactive") includeInactive?: string) {
    return this.service.listMembers(organizationId, includeInactive === "true");
  }

  @Get("invitations")
  @RequirePermissions(PERMISSIONS.TEAM_READ)
  invitations(@OrganizationId() organizationId: string) {
    return this.service.listInvitations(organizationId);
  }

  @Post("invite")
  @RequirePermissions(PERMISSIONS.TEAM_INVITE)
  invite(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @CurrentTenant() tenant: RequestTenant,
    @Body() dto: InviteMemberDto,
  ) {
    return this.service.invite(
      organizationId,
      user.id,
      dto,
      tenant.role as "OWNER" | "ADMIN" | "AGENT",
    );
  }

  @Patch(":membershipId/role")
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  updateRole(
    @OrganizationId() organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: RequestUser,
    @CurrentTenant() tenant: RequestTenant,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.service.updateRole(
      organizationId,
      membershipId,
      dto,
      user.id,
      tenant.role as "OWNER" | "ADMIN" | "AGENT",
    );
  }

  @Delete(":membershipId")
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  remove(
    @OrganizationId() organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: RequestUser,
    @CurrentTenant() tenant: RequestTenant,
  ) {
    return this.service.removeMember(
      organizationId,
      membershipId,
      user.id,
      tenant.role as "OWNER" | "ADMIN" | "AGENT",
    );
  }

  @Patch(":membershipId/suspend")
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  suspend(
    @OrganizationId() organizationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: RequestUser,
    @CurrentTenant() tenant: RequestTenant,
  ) {
    return this.service.suspendMember(
      organizationId,
      membershipId,
      user.id,
      tenant.role as "OWNER" | "ADMIN" | "AGENT",
    );
  }

  @Patch(":membershipId/reactivate")
  @RequirePermissions(PERMISSIONS.TEAM_MANAGE)
  reactivate(@OrganizationId() organizationId: string, @Param("membershipId") membershipId: string) {
    return this.service.reactivateMember(organizationId, membershipId);
  }
}
