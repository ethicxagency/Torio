import { Module } from "@nestjs/common";
import { CourierModule } from "../courier/courier.module";
import { DeliveryIntelligenceModule } from "../delivery-intelligence/delivery-intelligence.module";
import { BrainTrackingService } from "./brain-tracking.service";
import { TrackingController, PortalTrackingController } from "./tracking.controller";
import { TrackingService } from "./tracking.service";
import { TrackingSyncScheduler } from "./tracking-sync.scheduler";

@Module({
  imports: [CourierModule, DeliveryIntelligenceModule],
  controllers: [TrackingController, PortalTrackingController],
  providers: [TrackingService, TrackingSyncScheduler, BrainTrackingService],
  exports: [TrackingService, BrainTrackingService],
})
export class TrackingModule {}
