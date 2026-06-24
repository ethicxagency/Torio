import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { CustomerStatus } from "@prisma/client";
import { CustomersService } from "./customers.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CurrentTenant,
  CurrentUser,
  OrganizationId,
  RequestTenant,
  RequestUser,
} from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import {
  AssignCustomerDto,
  BulkCustomerActionDto,
  ImportCustomersDto,
  UpdateCustomerDto,
  UpdateCrmSettingsDto,
} from "./dto/customer.dto";

@Controller("customers")
@UseGuards(JwtAuthGuard, TenantGuard)
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  list(
    @OrganizationId() organizationId: string,
    @CurrentTenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Query("search") search?: string,
    @Query("status") status?: CustomerStatus,
    @Query("tagId") tagId?: string,
    @Query("assignedAgentId") assignedAgentId?: string,
    @Query("segmentId") segmentId?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: "asc" | "desc",
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.list(organizationId, {
      search,
      status,
      tagId,
      assignedAgentId,
      segmentId,
      sortBy,
      sortDir,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      role: tenant.role,
      userId: user.id,
    });
  }

  @Get("analytics/summary")
  @RequirePermissions(PERMISSIONS.ANALYTICS_READ)
  analytics(@OrganizationId() organizationId: string) {
    return this.service.getAnalytics(organizationId);
  }

  @Get("export/csv")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  async exportCsv(
    @OrganizationId() organizationId: string,
    @CurrentTenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
    @Query("search") search?: string,
    @Query("status") status?: CustomerStatus,
    @Res() res?: Response,
  ) {
    const { csv, filename } = await this.service.exportCsv(organizationId, {
      search,
      status,
      role: tenant.role,
      userId: user.id,
    });
    res!.setHeader("Content-Type", "text/csv");
    res!.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res!.send(csv);
  }

  @Post("import")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  import(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ImportCustomersDto,
  ) {
    return this.service.importCustomers(organizationId, dto, user.id);
  }

  @Post("bulk")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  bulk(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: BulkCustomerActionDto,
  ) {
    return this.service.bulkAction(organizationId, dto, user.id);
  }

  @Get("crm-settings")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  crmSettings(@OrganizationId() organizationId: string) {
    return this.service.getCrmSettings(organizationId);
  }

  @Patch("crm-settings")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  updateCrmSettings(@OrganizationId() organizationId: string, @Body() dto: UpdateCrmSettingsDto) {
    return this.service.updateCrmSettings(organizationId, dto);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  getOne(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @CurrentTenant() tenant: RequestTenant,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.getOne(organizationId, id, tenant.role, user.id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: RequestUser,
    @CurrentTenant() tenant: RequestTenant,
  ) {
    return this.service.update(organizationId, id, dto, user.id, tenant.role);
  }

  @Post(":id/assign")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  assign(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: AssignCustomerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assign(organizationId, id, dto, user.id);
  }

  @Post(":id/unassign")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
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
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addTag(organizationId, id, tagId, user.id);
  }

  @Delete(":id/tags/:tagId")
  @RequirePermissions(PERMISSIONS.TAGS_MANAGE)
  removeTag(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Param("tagId") tagId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.removeTag(organizationId, id, tagId, user.id);
  }
}
