import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ActivitiesService } from "./activities.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";

@Controller("customers/:customerId/activities")
@UseGuards(JwtAuthGuard, TenantGuard)
export class ActivitiesController {
  constructor(private service: ActivitiesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  list(
    @OrganizationId() organizationId: string,
    @Param("customerId") customerId: string,
    @Query("page") page?: string,
  ) {
    return this.service.listForCustomer(
      organizationId,
      customerId,
      page ? parseInt(page, 10) : 1,
    );
  }
}
