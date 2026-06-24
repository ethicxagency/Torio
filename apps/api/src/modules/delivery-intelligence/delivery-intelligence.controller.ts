import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { DeliveryIntelligenceService } from "./delivery-intelligence.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { UpdateDeliveryIntelligenceDto } from "../courier/dto/courier.dto";

@Controller("delivery-intelligence")
@UseGuards(JwtAuthGuard, TenantGuard)
export class DeliveryIntelligenceController {
  constructor(private service: DeliveryIntelligenceService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  get(@OrganizationId() organizationId: string) {
    return this.service.get(organizationId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateDeliveryIntelligenceDto,
  ) {
    return this.service.update(organizationId, dto);
  }
}
