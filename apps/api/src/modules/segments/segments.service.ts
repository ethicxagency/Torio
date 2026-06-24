import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { CreateSegmentDto, UpdateSegmentDto } from "./dto/segment.dto";

@Injectable()
export class SegmentsService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.customerSegment.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async create(organizationId: string, dto: CreateSegmentDto) {
    return this.prisma.customerSegment.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
        color: dto.color,
        type: "CUSTOM",
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateSegmentDto) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!segment) throw new NotFoundException("Segment not found");
    if (segment.isSystem && dto.name) {
      throw new BadRequestException("Cannot rename system segments");
    }

    return this.prisma.customerSegment.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        filters: dto.filters as Prisma.InputJsonValue | undefined,
        color: dto.color,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!segment) throw new NotFoundException("Segment not found");
    if (segment.isSystem) throw new BadRequestException("Cannot delete system segments");

    await this.prisma.customerSegment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async countCustomers(organizationId: string, id: string) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!segment) throw new NotFoundException("Segment not found");

    const filters = segment.filters as Record<string, unknown>;
    const where: Prisma.CustomerWhereInput = { organizationId, deletedAt: null };

    if (filters.customerType) where.customerType = filters.customerType as Prisma.EnumCustomerTypeFilter;
    if (filters.status) where.status = filters.status as Prisma.EnumCustomerStatusFilter;
    if (filters.inactiveDays) {
      where.lastContactAt = { lt: new Date(Date.now() - Number(filters.inactiveDays) * 86400000) };
    }
    if (filters.daysSinceFirstContact) {
      where.firstContactAt = { gte: new Date(Date.now() - Number(filters.daysSinceFirstContact) * 86400000) };
    }

    const count = await this.prisma.customer.count({ where });
    return { segmentId: id, count };
  }
}
