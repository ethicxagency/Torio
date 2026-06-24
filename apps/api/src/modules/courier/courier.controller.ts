import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CourierService } from "./courier.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import {
  CreateCourierConnectionDto,
  UpdateCourierConnectionDto,
  UpdateShippingDeliverySettingsDto,
} from "./dto/courier.dto";

@Controller("courier/connections")
@UseGuards(JwtAuthGuard, TenantGuard)
export class CourierController {
  constructor(private service: CourierService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  list(@OrganizationId() organizationId: string) {
    return this.service.listConnections(organizationId);
  }

  @Get("providers")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  listProviders() {
    return this.service.listProviders();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateCourierConnectionDto) {
    return this.service.createConnection(organizationId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCourierConnectionDto,
  ) {
    return this.service.updateConnection(organizationId, id, dto);
  }

  @Post(":id/test")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  test(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.testConnection(organizationId, id);
  }

  @Post(":id/reconnect")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  reconnect(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.reconnect(organizationId, id);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  disconnect(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.disconnect(organizationId, id);
  }
}

@Controller("settings/shipping-delivery")
@UseGuards(JwtAuthGuard, TenantGuard)
export class ShippingDeliverySettingsController {
  constructor(private service: CourierService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  get(@OrganizationId() organizationId: string) {
    return this.service.getSettings(organizationId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(
    @OrganizationId() organizationId: string,
    @Body() dto: UpdateShippingDeliverySettingsDto,
  ) {
    return this.service.updateSettings(organizationId, dto);
  }
}
