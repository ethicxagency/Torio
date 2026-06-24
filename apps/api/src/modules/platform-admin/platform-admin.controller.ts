import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { PlatformAdminService, PlatformAdminLoginDto } from "./platform-admin.service";
import { Public, PlatformAdminOnly } from "../../common/decorators/auth.decorators";
import { PlatformAdminGuard } from "../../common/guards/platform-admin.guard";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

@Controller("platform-admin")
export class PlatformAdminController {
  constructor(
    private service: PlatformAdminService,
    private auditLogsService: AuditLogsService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: PlatformAdminLoginDto) {
    return this.service.login(dto);
  }

  @Get("dashboard")
  @PlatformAdminOnly()
  @UseGuards(PlatformAdminGuard)
  dashboard() {
    return this.service.getDashboardMetrics();
  }

  @Get("organizations")
  @PlatformAdminOnly()
  @UseGuards(PlatformAdminGuard)
  organizations(@Query("page") page?: string) {
    return this.service.listOrganizations(page ? parseInt(page, 10) : 1);
  }

  @Patch("organizations/:id/suspend")
  @PlatformAdminOnly()
  @UseGuards(PlatformAdminGuard)
  suspend(@Param("id") id: string, @Req() req: { user: { id: string } }) {
    return this.service.suspendOrganization(id, req.user.id);
  }

  @Delete("organizations/:id")
  @PlatformAdminOnly()
  @UseGuards(PlatformAdminGuard)
  delete(@Param("id") id: string, @Req() req: { user: { id: string } }) {
    return this.service.deleteOrganization(id, req.user.id);
  }

  @Get("audit-logs")
  @PlatformAdminOnly()
  @UseGuards(PlatformAdminGuard)
  listAuditLogs(@Query("page") page?: string) {
    return this.auditLogsService.findPlatform(page ? parseInt(page, 10) : 1);
  }
}
