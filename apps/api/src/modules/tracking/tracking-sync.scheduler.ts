import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { TrackingService } from "./tracking.service";

@Injectable()
export class TrackingSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingSyncScheduler.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private lastRunByOrg = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private trackingService: TrackingService,
  ) {}

  onModuleInit() {
    this.intervalRef = setInterval(() => {
      void this.tick();
    }, 5 * 60 * 1000);
    this.logger.log("Tracking sync scheduler started (checks every 5 minutes)");
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
  }

  private async tick() {
    try {
      const settings = await this.prisma.shippingDeliverySettings.findMany({
        include: {
          organization: {
            select: {
              id: true,
              courierConnections: {
                where: { deletedAt: null, status: "CONNECTED" },
                select: { id: true },
              },
            },
          },
        },
      });

      const now = Date.now();

      for (const setting of settings) {
        if (!setting.organization.courierConnections.length) continue;

        const intervalMs = this.trackingService.getSyncIntervalMs(setting.syncInterval);
        const lastRun = this.lastRunByOrg.get(setting.organizationId) ?? 0;
        if (now - lastRun < intervalMs) continue;

        this.lastRunByOrg.set(setting.organizationId, now);
        const result = await this.trackingService.syncOrganization(setting.organizationId);
        this.logger.debug(
          `Synced org ${setting.organizationId}: ${result.synced}/${result.total} shipments`,
        );
      }
    } catch (error) {
      this.logger.error("Tracking sync tick failed", error);
    }
  }
}
