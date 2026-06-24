import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TagsService } from "./tags.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { CreateTagDto, UpdateTagDto } from "./dto/tag.dto";

@Controller("tags")
@UseGuards(JwtAuthGuard, TenantGuard)
export class TagsController {
  constructor(private service: TagsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  list(@OrganizationId() organizationId: string) {
    return this.service.list(organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TAGS_MANAGE)
  create(@OrganizationId() organizationId: string, @Body() dto: CreateTagDto) {
    return this.service.create(organizationId, dto);
  }

  @Patch(":id")
  @RequirePermissions(PERMISSIONS.TAGS_MANAGE)
  update(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Delete(":id")
  @RequirePermissions(PERMISSIONS.TAGS_MANAGE)
  remove(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.service.remove(organizationId, id);
  }
}
