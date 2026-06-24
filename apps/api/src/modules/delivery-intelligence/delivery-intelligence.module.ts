import { Module } from "@nestjs/common";
import { DeliveryIntelligenceController } from "./delivery-intelligence.controller";
import { DeliveryIntelligenceService } from "./delivery-intelligence.service";

@Module({
  controllers: [DeliveryIntelligenceController],
  providers: [DeliveryIntelligenceService],
  exports: [DeliveryIntelligenceService],
})
export class DeliveryIntelligenceModule {}
