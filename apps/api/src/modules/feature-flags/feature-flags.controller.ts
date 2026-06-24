import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { FeatureFlagsService } from "./feature-flags.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { IsBoolean, IsString } from "class-validator";

class UpdateFlagDto {
  @IsString()
  key!: string;

  @IsBoolean()
  enabled!: boolean;
}

@Controller("feature-flags")
@UseGuards(JwtAuthGuard, TenantGuard)
export class FeatureFlagsController {
  constructor(private service: FeatureFlagsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  list(@OrganizationId() organizationId: string) {
    return this.service.getFlags(organizationId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  update(@OrganizationId() organizationId: string, @Body() dto: UpdateFlagDto) {
    return this.service.setFlag(organizationId, dto.key, dto.enabled);
  }
}
