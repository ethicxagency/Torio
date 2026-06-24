import { Module } from "@nestjs/common";
import { PlatformAdminService } from "./platform-admin.service";
import { PlatformAdminController } from "./platform-admin.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
