import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { SegmentsService } from "./segments.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { CreateSegmentDto, UpdateSegmentDto } from "./dto/segment.dto";

@Controller("segments")
@UseGuards(JwtAuthGuard, TenantGuard)
export class SegmentsController {
  constructor(private service: SegmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  list(@OrganizationId() organizationId: string) {
    return this.service.list(organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateSegmentDto) {
    return this.service.create(organizationId, dto);
  }

  @Get(":id/count")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  count(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.countCustomers(organizationId, id);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.CUSTOMERS_UPDATE)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.remove(organizationId, id);
  }
}
