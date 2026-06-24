import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { UpdateDeliveryIntelligenceDto } from "../courier/dto/courier.dto";

@Injectable()
export class DeliveryIntelligenceService {
  constructor(private prisma: PrismaService) {}

  async get(organizationId: string) {
    return this.prisma.deliveryIntelligence.upsert({
      where: { organizationId },
      create: { organizationId },
      update: {},
    });
  }

  async update(organizationId: string, dto: UpdateDeliveryIntelligenceDto) {
    const data = {
      courierPreferences: dto.courierPreferences as Prisma.InputJsonValue | undefined,
      deliveryPolicies: dto.deliveryPolicies as Prisma.InputJsonValue | undefined,
      shippingRules: dto.shippingRules as Prisma.InputJsonValue | undefined,
      trackingInstructions: dto.trackingInstructions,
    };

    return this.prisma.deliveryIntelligence.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  formatForPrompt(
    intelligence: Awaited<ReturnType<DeliveryIntelligenceService["get"]>>,
  ): string {
    const sections: string[] = [];

    if (intelligence.trackingInstructions) {
      sections.push(`Tracking Instructions: ${intelligence.trackingInstructions}`);
    }

    if (intelligence.courierPreferences) {
      sections.push(`Courier Preferences: ${JSON.stringify(intelligence.courierPreferences)}`);
    }

    if (intelligence.deliveryPolicies) {
      sections.push(`Delivery Policies: ${JSON.stringify(intelligence.deliveryPolicies)}`);
    }

    if (intelligence.shippingRules) {
      sections.push(`Shipping Rules: ${JSON.stringify(intelligence.shippingRules)}`);
    }

    return sections.join("\n");
  }
}
