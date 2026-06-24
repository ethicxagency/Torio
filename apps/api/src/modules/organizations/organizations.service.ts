import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { UpdateOrganizationDto } from "./dto/organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async findOne(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      include: {
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
          include: { plan: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        aiSettings: true,
        _count: {
          select: {
            memberships: { where: { isActive: true, deletedAt: null } },
            channels: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async update(
    organizationId: string,
    dto: UpdateOrganizationDto,
    userId: string,
  ) {
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    });

    await this.auditLogs.create({
      action: "SETTINGS_UPDATED",
      organizationId,
      userId,
      resource: "organization",
      resourceId: organizationId,
      metadata: dto as unknown as import("@prisma/client").Prisma.InputJsonValue,
    });

    return org;
  }
}
