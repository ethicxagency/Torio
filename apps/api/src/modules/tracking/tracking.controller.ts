import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { TrackingService } from "./tracking.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import { OrganizationId } from "../../common/decorators/current-user.decorator";
import { RequirePermissions, Public } from "../../common/decorators/auth.decorators";
import { PERMISSIONS } from "@mango/shared";
import { SyncTrackingDto, TrackingLookupQueryDto } from "../courier/dto/courier.dto";

@Controller("tracking")
export class TrackingController {
  constructor(private service: TrackingService) {}

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  lookup(@OrganizationId() organizationId: string, @Query() query: TrackingLookupQueryDto) {
    return this.service.lookup(organizationId, query);
  }

  @Get("analytics")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.ANALYTICS_READ)
  analytics(@OrganizationId() organizationId: string) {
    return this.service.getAnalytics(organizationId);
  }

  @Get(":orderId")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  byOrderId(@OrganizationId() organizationId: string, @Param("orderId") orderId: string) {
    return this.service.getByOrderId(organizationId, orderId);
  }

  @Get(":id/timeline")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.INBOX_READ)
  timeline(
    @OrganizationId() organizationId: string,
    @Param("id") id: string,
  ) {
    return this.service.getTimeline(organizationId, id);
  }

  @Post("sync")
  @UseGuards(JwtAuthGuard, TenantGuard)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  sync(@OrganizationId() organizationId: string, @Body() dto: SyncTrackingDto) {
    return this.service.sync(organizationId, dto);
  }
}

@Controller("portal/tracking")
export class PortalTrackingController {
  constructor(private service: TrackingService) {}

  @Public()
  @Get()
  lookup(
    @Query("organizationSlug") organizationSlug: string,
    @Query("orderId") orderId?: string,
    @Query("orderNumber") orderNumber?: string,
    @Query("trackingNumber") trackingNumber?: string,
  ) {
    return this.service.portalLookup(organizationSlug, { orderId, orderNumber, trackingNumber });
  }
}
