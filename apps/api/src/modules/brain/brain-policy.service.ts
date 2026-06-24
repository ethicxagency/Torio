import { Injectable, NotFoundException } from "@nestjs/common";
import { PolicyCategoryType, PolicyStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { BrainKnowledgeSource } from "./brain-context.service";
import {
  POLICY_CATEGORY_META,
  POLICY_KEYWORDS,
  POLICY_TEMPLATES,
  PolicyTemplateId,
} from "./brain-policy.constants";
import {
  ApplyPolicyTemplateDto,
  UpdateCancellationPolicyDto,
  UpdateExchangePolicyDto,
  UpdatePaymentPolicyDto,
  UpdateRefundPolicyDto,
  UpdateReturnPolicyDto,
  UpdateShippingPolicyDto,
} from "./dto/brain.dto";

@Injectable()
export class BrainPolicyService {
  constructor(private prisma: PrismaService) {}

  async ensureInitialized(organizationId: string) {
    for (const [type, meta] of Object.entries(POLICY_CATEGORY_META)) {
      await this.prisma.policyCategory.upsert({
        where: {
          organizationId_type: {
            organizationId,
            type: type as PolicyCategoryType,
          },
        },
        create: {
          organizationId,
          type: type as PolicyCategoryType,
          title: meta.title,
          sortOrder: meta.sortOrder,
        },
        update: {},
      });
    }

    const [shipping, payment, returnPolicy, refund, exchange, cancellation] = await Promise.all([
      this.prisma.shippingPolicy.findUnique({ where: { organizationId } }),
      this.prisma.paymentPolicy.findUnique({ where: { organizationId } }),
      this.prisma.returnPolicy.findUnique({ where: { organizationId } }),
      this.prisma.refundPolicy.findUnique({ where: { organizationId } }),
      this.prisma.exchangePolicy.findUnique({ where: { organizationId } }),
      this.prisma.cancellationPolicy.findUnique({ where: { organizationId } }),
    ]);

    if (!shipping && !payment && !returnPolicy) {
      await this.applyTemplate(organizationId, { templateId: "GENERAL", publish: true });
    } else {
      if (!shipping) await this.prisma.shippingPolicy.create({ data: { organizationId } });
      if (!payment) await this.prisma.paymentPolicy.create({ data: { organizationId } });
      if (!returnPolicy) await this.prisma.returnPolicy.create({ data: { organizationId } });
      if (!refund) await this.prisma.refundPolicy.create({ data: { organizationId } });
      if (!exchange) await this.prisma.exchangePolicy.create({ data: { organizationId } });
      if (!cancellation) await this.prisma.cancellationPolicy.create({ data: { organizationId } });
    }
  }

  async getAll(organizationId: string) {
    await this.ensureInitialized(organizationId);
    const [categories, shipping, payment, returnPolicy, refund, exchange, cancellation, templates] =
      await Promise.all([
        this.prisma.policyCategory.findMany({
          where: { organizationId },
          orderBy: { sortOrder: "asc" },
        }),
        this.prisma.shippingPolicy.findUnique({ where: { organizationId } }),
        this.prisma.paymentPolicy.findUnique({ where: { organizationId } }),
        this.prisma.returnPolicy.findUnique({ where: { organizationId } }),
        this.prisma.refundPolicy.findUnique({ where: { organizationId } }),
        this.prisma.exchangePolicy.findUnique({ where: { organizationId } }),
        this.prisma.cancellationPolicy.findUnique({ where: { organizationId } }),
        Promise.resolve(
          Object.values(POLICY_TEMPLATES).map(({ id, name, description }) => ({
            id,
            name,
            description,
          })),
        ),
      ]);

    return {
      categories,
      shipping,
      payment,
      return: returnPolicy,
      refund,
      exchange,
      cancellation,
      templates,
    };
  }

  async updateShipping(organizationId: string, dto: UpdateShippingPolicyDto) {
    await this.ensureInitialized(organizationId);
    const { publish, status, ...data } = dto;
    const nextStatus = publish ? PolicyStatus.PUBLISHED : status ?? undefined;
    const policy = await this.prisma.shippingPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data, status: nextStatus ?? PolicyStatus.DRAFT },
      update: { ...data, status: nextStatus ?? undefined },
    });
    if (publish) await this.saveVersion(organizationId, PolicyCategoryType.SHIPPING, policy);
    return policy;
  }

  async updatePayment(organizationId: string, dto: UpdatePaymentPolicyDto) {
    await this.ensureInitialized(organizationId);
    const { publish, status, ...data } = dto;
    const nextStatus = publish ? PolicyStatus.PUBLISHED : status ?? undefined;
    const policy = await this.prisma.paymentPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data, status: nextStatus ?? PolicyStatus.DRAFT },
      update: { ...data, status: nextStatus ?? undefined },
    });
    if (publish) await this.saveVersion(organizationId, PolicyCategoryType.PAYMENT, policy);
    return policy;
  }

  async updateReturn(organizationId: string, dto: UpdateReturnPolicyDto) {
    await this.ensureInitialized(organizationId);
    const { publish, status, ...data } = dto;
    const nextStatus = publish ? PolicyStatus.PUBLISHED : status ?? undefined;
    const policy = await this.prisma.returnPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data, status: nextStatus ?? PolicyStatus.DRAFT },
      update: { ...data, status: nextStatus ?? undefined },
    });
    if (publish) await this.saveVersion(organizationId, PolicyCategoryType.RETURN, policy);
    return policy;
  }

  async updateRefund(organizationId: string, dto: UpdateRefundPolicyDto) {
    await this.ensureInitialized(organizationId);
    const { publish, status, ...data } = dto;
    const nextStatus = publish ? PolicyStatus.PUBLISHED : status ?? undefined;
    const policy = await this.prisma.refundPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data, status: nextStatus ?? PolicyStatus.DRAFT },
      update: { ...data, status: nextStatus ?? undefined },
    });
    if (publish) await this.saveVersion(organizationId, PolicyCategoryType.REFUND, policy);
    return policy;
  }

  async updateExchange(organizationId: string, dto: UpdateExchangePolicyDto) {
    await this.ensureInitialized(organizationId);
    const { publish, status, ...data } = dto;
    const nextStatus = publish ? PolicyStatus.PUBLISHED : status ?? undefined;
    const policy = await this.prisma.exchangePolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data, status: nextStatus ?? PolicyStatus.DRAFT },
      update: { ...data, status: nextStatus ?? undefined },
    });
    if (publish) await this.saveVersion(organizationId, PolicyCategoryType.EXCHANGE, policy);
    return policy;
  }

  async updateCancellation(organizationId: string, dto: UpdateCancellationPolicyDto) {
    await this.ensureInitialized(organizationId);
    const { publish, status, ...data } = dto;
    const nextStatus = publish ? PolicyStatus.PUBLISHED : status ?? undefined;
    const policy = await this.prisma.cancellationPolicy.upsert({
      where: { organizationId },
      create: { organizationId, ...data, status: nextStatus ?? PolicyStatus.DRAFT },
      update: { ...data, status: nextStatus ?? undefined },
    });
    if (publish) await this.saveVersion(organizationId, PolicyCategoryType.CANCELLATION, policy);
    return policy;
  }

  async listVersions(organizationId: string, policyType?: PolicyCategoryType) {
    return this.prisma.policyVersion.findMany({
      where: { organizationId, ...(policyType ? { policyType } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async applyTemplate(organizationId: string, dto: ApplyPolicyTemplateDto) {
    const template = POLICY_TEMPLATES[dto.templateId as PolicyTemplateId];
    if (!template) throw new NotFoundException("Policy template not found");

    const publish = dto.publish ?? false;
    const status = publish ? PolicyStatus.PUBLISHED : PolicyStatus.DRAFT;

    await Promise.all([
      this.prisma.shippingPolicy.upsert({
        where: { organizationId },
        create: { organizationId, ...template.shipping, status },
        update: { ...template.shipping, status },
      }),
      this.prisma.paymentPolicy.upsert({
        where: { organizationId },
        create: { organizationId, ...template.payment, status },
        update: { ...template.payment, status },
      }),
      this.prisma.returnPolicy.upsert({
        where: { organizationId },
        create: { organizationId, ...template.return, status },
        update: { ...template.return, status },
      }),
      this.prisma.refundPolicy.upsert({
        where: { organizationId },
        create: { organizationId, ...template.refund, status },
        update: { ...template.refund, status },
      }),
      this.prisma.exchangePolicy.upsert({
        where: { organizationId },
        create: { organizationId, ...template.exchange, status },
        update: { ...template.exchange, status },
      }),
      this.prisma.cancellationPolicy.upsert({
        where: { organizationId },
        create: { organizationId, ...template.cancellation, status },
        update: { ...template.cancellation, status },
      }),
    ]);

    if (publish) {
      const all = await this.getAll(organizationId);
      await Promise.all([
        this.saveVersion(organizationId, PolicyCategoryType.SHIPPING, all.shipping),
        this.saveVersion(organizationId, PolicyCategoryType.PAYMENT, all.payment),
        this.saveVersion(organizationId, PolicyCategoryType.RETURN, all.return),
        this.saveVersion(organizationId, PolicyCategoryType.REFUND, all.refund),
        this.saveVersion(organizationId, PolicyCategoryType.EXCHANGE, all.exchange),
        this.saveVersion(organizationId, PolicyCategoryType.CANCELLATION, all.cancellation),
      ]);
    }

    return this.getAll(organizationId);
  }

  async getRelevantPolicies(
    organizationId: string,
    customerMessage: string,
  ): Promise<BrainKnowledgeSource[]> {
    await this.ensureInitialized(organizationId);
    const all = await this.getAll(organizationId);
    const query = customerMessage.toLowerCase();
    const sources: BrainKnowledgeSource[] = [];

    const candidates: Array<{
      type: PolicyCategoryType;
      label: string;
      content: string;
      published: boolean;
    }> = [
      {
        type: PolicyCategoryType.SHIPPING,
        label: "Shipping Policy",
        content: this.formatShipping(all.shipping),
        published: all.shipping?.status === PolicyStatus.PUBLISHED,
      },
      {
        type: PolicyCategoryType.PAYMENT,
        label: "Payment Policy",
        content: this.formatPayment(all.payment),
        published: all.payment?.status === PolicyStatus.PUBLISHED,
      },
      {
        type: PolicyCategoryType.RETURN,
        label: "Return Policy",
        content: this.formatReturn(all.return),
        published: all.return?.status === PolicyStatus.PUBLISHED,
      },
      {
        type: PolicyCategoryType.REFUND,
        label: "Refund Policy",
        content: this.formatRefund(all.refund),
        published: all.refund?.status === PolicyStatus.PUBLISHED,
      },
      {
        type: PolicyCategoryType.EXCHANGE,
        label: "Exchange Policy",
        content: this.formatExchange(all.exchange),
        published: all.exchange?.status === PolicyStatus.PUBLISHED,
      },
      {
        type: PolicyCategoryType.CANCELLATION,
        label: "Cancellation Policy",
        content: this.formatCancellation(all.cancellation),
        published: all.cancellation?.status === PolicyStatus.PUBLISHED,
      },
    ];

    for (const candidate of candidates) {
      if (!candidate.content.trim()) continue;
      const keywords = POLICY_KEYWORDS[candidate.type];
      const score = keywords.filter((keyword) => query.includes(keyword)).length;
      if (score === 0 && !this.matchesPolicyQuery(query, candidate.type)) continue;

      sources.push({
        type: "policy",
        id: candidate.type,
        label: candidate.label,
        content: candidate.content,
        priority: 92 + score * 2 + (candidate.published ? 5 : 0),
      });
    }

    return sources.sort((a, b) => b.priority - a.priority);
  }

  matchPoliciesForTest(organizationId: string, question: string) {
    return this.getRelevantPolicies(organizationId, question);
  }

  private matchesPolicyQuery(query: string, type: PolicyCategoryType) {
    if (type === PolicyCategoryType.RETURN && /can i return|return this|returnable/i.test(query)) {
      return true;
    }
    if (type === PolicyCategoryType.REFUND && /when.*refund|refund.*when|receive.*refund/i.test(query)) {
      return true;
    }
    if (type === PolicyCategoryType.EXCHANGE && /how many days.*exchange|exchange.*days/i.test(query)) {
      return true;
    }
    return false;
  }

  private async saveVersion(organizationId: string, policyType: PolicyCategoryType, snapshot: unknown) {
    await this.prisma.policyVersion.create({
      data: {
        organizationId,
        policyType,
        snapshot: snapshot as object,
        status: PolicyStatus.PUBLISHED,
      },
    });
  }

  private formatShipping(policy: Awaited<ReturnType<BrainPolicyService["getAll"]>>["shipping"]) {
    if (!policy) return "";
    return [
      policy.deliveryAreas && `Delivery areas: ${policy.deliveryAreas}`,
      policy.deliveryTime && `Delivery time: ${policy.deliveryTime}`,
      policy.deliveryCharge && `Delivery charge: ${policy.deliveryCharge}`,
      policy.internationalShipping && `International shipping: ${policy.internationalShipping}`,
      policy.courierInfo && `Courier: ${policy.courierInfo}`,
      policy.additionalNotes,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatPayment(policy: Awaited<ReturnType<BrainPolicyService["getAll"]>>["payment"]) {
    if (!policy) return "";
    return [
      policy.cashOnDelivery && `Cash On Delivery: ${policy.cashOnDelivery}`,
      policy.onlinePayment && `Online payment: ${policy.onlinePayment}`,
      policy.bankTransfer && `Bank transfer: ${policy.bankTransfer}`,
      policy.mobileBanking && `Mobile banking: ${policy.mobileBanking}`,
      policy.additionalNotes,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatReturn(policy: Awaited<ReturnType<BrainPolicyService["getAll"]>>["return"]) {
    if (!policy) return "";
    return [
      `Return available: ${policy.returnAvailable ? "Yes" : "No"}`,
      policy.returnWindow && `Return window: ${policy.returnWindow}`,
      policy.returnConditions.length &&
        `Return conditions: ${policy.returnConditions.join("; ")}`,
      policy.nonReturnableItems.length &&
        `Non-returnable items: ${policy.nonReturnableItems.join("; ")}`,
      policy.additionalNotes,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatRefund(policy: Awaited<ReturnType<BrainPolicyService["getAll"]>>["refund"]) {
    if (!policy) return "";
    return [
      `Refund available: ${policy.refundAvailable ? "Yes" : "No"}`,
      policy.refundProcessingTime && `Refund processing time: ${policy.refundProcessingTime}`,
      policy.refundMethods.length && `Refund methods: ${policy.refundMethods.join(", ")}`,
      policy.refundConditions && `Refund conditions: ${policy.refundConditions}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatExchange(policy: Awaited<ReturnType<BrainPolicyService["getAll"]>>["exchange"]) {
    if (!policy) return "";
    return [
      `Exchange available: ${policy.exchangeAvailable ? "Yes" : "No"}`,
      policy.exchangeWindow && `Exchange window: ${policy.exchangeWindow}`,
      policy.exchangeConditions && `Exchange conditions: ${policy.exchangeConditions}`,
      policy.exchangeProcess && `Exchange process: ${policy.exchangeProcess}`,
      policy.additionalNotes,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private formatCancellation(policy: Awaited<ReturnType<BrainPolicyService["getAll"]>>["cancellation"]) {
    if (!policy) return "";
    return [
      `Cancellation allowed: ${policy.cancellationAllowed ? "Yes" : "No"}`,
      policy.cancellationWindow && `Cancellation window: ${policy.cancellationWindow}`,
      policy.cancellationConditions && `Cancellation conditions: ${policy.cancellationConditions}`,
      policy.additionalNotes,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
