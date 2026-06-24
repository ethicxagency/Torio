import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { CreateCustomerMemoryDto, UpdateCustomerMemoryDto } from "./dto/brain.dto";
import { BrainKnowledgeSource } from "./brain-context.service";

@Injectable()
export class BrainMemoryService {
  constructor(private prisma: PrismaService) {}

  async listForCustomer(organizationId: string, customerId: string) {
    await this.assertCustomer(organizationId, customerId);
    return this.prisma.customerMemory.findMany({
      where: { organizationId, customerId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.customerMemory.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  }

  async create(organizationId: string, dto: CreateCustomerMemoryDto) {
    await this.assertCustomer(organizationId, dto.customerId);
    return this.prisma.customerMemory.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        memory: dto.memory,
        confidenceScore: dto.confidenceScore ?? 0.8,
        source: dto.source ?? "manual",
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerMemoryDto) {
    const memory = await this.prisma.customerMemory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!memory) throw new NotFoundException("Memory not found");

    return this.prisma.customerMemory.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    const memory = await this.prisma.customerMemory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!memory) throw new NotFoundException("Memory not found");

    await this.prisma.customerMemory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async getRelevantMemories(
    organizationId: string,
    customerId: string | undefined,
    question: string,
  ): Promise<BrainKnowledgeSource[]> {
    if (!customerId) return [];

    const memories = await this.prisma.customerMemory.findMany({
      where: { organizationId, customerId, deletedAt: null },
      orderBy: { confidenceScore: "desc" },
    });

    const query = question.toLowerCase();
    return memories
      .map((m) => ({
        memory: m,
        score: this.scoreMatch(query, m.memory),
      }))
      .filter((item) => item.score > 0 || item.memory.confidenceScore >= 0.7)
      .sort(
        (a: { score: number; memory: { confidenceScore: number } }, b: { score: number; memory: { confidenceScore: number } }) =>
          b.score - a.score || b.memory.confidenceScore - a.memory.confidenceScore,
      )
      .slice(0, 5)
      .map(({ memory, score }: { memory: { id: string; memory: string }; score: number }) => ({
        type: "memory" as const,
        id: memory.id,
        label: "Customer Memory",
        content: memory.memory,
        priority: 70 + score,
      }));
  }

  private scoreMatch(query: string, text: string): number {
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    const normalized = text.toLowerCase();
    return words.filter((w) => normalized.includes(w)).length;
  }

  private async assertCustomer(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException("Customer not found");
  }
}
