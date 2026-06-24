import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { UpdateSalesPlaybookDto } from "./dto/brain.dto";

const DEFAULT_PLAYBOOK = {
  upsellRules: [
    { trigger: "price_inquiry", action: "mention_premium_variant", message: "Mention premium quality and durability benefits." },
    { trigger: "buying_intent", action: "suggest_bundle", message: "Offer bundle deal with related accessories." },
  ],
  crossSellRules: [
    { trigger: "shirt", action: "recommend_accessories", categories: ["socks", "belt", "cap"] },
    { trigger: "shoes", action: "recommend_care", categories: ["socks", "shoe care"] },
  ],
  salesScripts: [
    { trigger: "price_inquiry", script: "Share price, then highlight product benefits and quality." },
    { trigger: "delivery", script: "Mention Cash On Delivery and fast courier delivery across Bangladesh." },
    { trigger: "stock", script: "Confirm availability and create urgency if stock is limited." },
  ],
  objectionHandling: [
    { objection: "too expensive", response: "Explain value, quality materials, and long-term durability." },
    { objection: "delivery charge", response: "Highlight free delivery threshold or COD convenience." },
    { objection: "not sure", response: "Offer size guide, return policy, and customer reviews." },
  ],
};

@Injectable()
export class BrainSalesPlaybookService {
  constructor(private prisma: PrismaService) {}

  async get(organizationId: string) {
    const existing = await this.prisma.salesPlaybook.findUnique({
      where: { organizationId },
    });

    if (existing) return existing;

    return this.prisma.salesPlaybook.create({
      data: {
        organizationId,
        upsellRules: DEFAULT_PLAYBOOK.upsellRules,
        crossSellRules: DEFAULT_PLAYBOOK.crossSellRules,
        salesScripts: DEFAULT_PLAYBOOK.salesScripts,
        objectionHandling: DEFAULT_PLAYBOOK.objectionHandling,
      },
    });
  }

  async update(organizationId: string, dto: UpdateSalesPlaybookDto) {
    await this.get(organizationId);
    return this.prisma.salesPlaybook.update({
      where: { organizationId },
      data: {
        upsellRules: dto.upsellRules ?? undefined,
        crossSellRules: dto.crossSellRules ?? undefined,
        salesScripts: dto.salesScripts ?? undefined,
        objectionHandling: dto.objectionHandling ?? undefined,
        isActive: dto.isActive,
      },
    });
  }

  getScriptForTrigger(playbook: Awaited<ReturnType<BrainSalesPlaybookService["get"]>>, trigger: string) {
    const scripts = (playbook.salesScripts as Array<{ trigger: string; script: string }>) ?? [];
    return scripts.find((item) => item.trigger === trigger)?.script;
  }

  getObjectionResponse(
    playbook: Awaited<ReturnType<BrainSalesPlaybookService["get"]>>,
    objection: string,
  ) {
    const handlers = (playbook.objectionHandling as Array<{ objection: string; response: string }>) ?? [];
    const normalized = objection.toLowerCase();
    return handlers.find((item) => normalized.includes(item.objection))?.response;
  }
}
