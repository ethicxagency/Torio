import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";

@Injectable()
export class FeatureFlagsService {
  constructor(private prisma: PrismaService) {}

  async getFlags(organizationId: string) {
    return this.prisma.featureFlag.findMany({
      where: { organizationId },
    });
  }

  async isEnabled(organizationId: string, key: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    return flag?.enabled ?? false;
  }

  async setFlag(organizationId: string, key: string, enabled: boolean) {
    return this.prisma.featureFlag.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { enabled },
      create: { organizationId, key, enabled },
    });
  }
}
