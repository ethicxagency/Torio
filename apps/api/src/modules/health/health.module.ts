import { Controller, Get } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { Public } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.module";

@Controller("health")
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "torio-api",
    };
  }
}

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
