import { Controller, Get, UseGuards } from "@nestjs/common";
import { RbacService } from "./rbac.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { CurrentTenant } from "../../common/decorators/current-user.decorator";
import { RequestTenant } from "../../common/decorators/current-user.decorator";
import { MembershipRole } from "@prisma/client";

@Controller("rbac")
@UseGuards(JwtAuthGuard, TenantGuard)
export class RbacController {
  constructor(private service: RbacService) {}

  @Get("permissions")
  myPermissions(@CurrentTenant() tenant: RequestTenant) {
    return { role: tenant.role, permissions: tenant.permissions };
  }

  @Get("roles/:role/permissions")
  rolePermissions(@CurrentTenant() tenant: RequestTenant) {
    return this.service.getPermissionsForRole(tenant.role as MembershipRole);
  }
}
