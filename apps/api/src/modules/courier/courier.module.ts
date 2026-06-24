import { Module } from "@nestjs/common";
import { CourierController, ShippingDeliverySettingsController } from "./courier.controller";
import { CourierService } from "./courier.service";

@Module({
  controllers: [CourierController, ShippingDeliverySettingsController],
  providers: [CourierService],
  exports: [CourierService],
})
export class CourierModule {}
