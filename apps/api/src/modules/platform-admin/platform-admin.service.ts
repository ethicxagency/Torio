import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma/prisma.module";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { IsEmail, IsString, MinLength } from "class-validator";

export class PlatformAdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

@Injectable()
export class PlatformAdminService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private auditLogs: AuditLogsService,
  ) {}

  async login(dto: PlatformAdminLoginDto) {
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { email: dto.email, isActive: true, deletedAt: null },
    });

    if (!admin) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditLogs.create({
      action: "LOGIN",
      platformAdminId: admin.id,
    });

    const accessToken = this.jwt.sign(
      { sub: admin.id, email: admin.email, admin: true, type: "access" },
      { secret: this.config.get<string>("JWT_ACCESS_SECRET"), expiresIn: "8h" },
    );

    return {
      admin: { id: admin.id, email: admin.email, name: admin.name },
      accessToken,
    };
  }

  async getDashboardMetrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeConversations,
      activeSubscriptions,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({ where: { status: "ACTIVE", deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.conversation.count({ where: { status: "OPEN", deletedAt: null } }),
      this.prisma.subscription.findMany({
        where: { status: { in: ["ACTIVE", "TRIALING"] } },
        include: { plan: true },
      }),
    ]);

    const monthlyRevenue = activeSubscriptions.reduce(
      (sum, sub) => sum + sub.plan.priceMonthly,
      0,
    );

    const messageUsage = await this.prisma.usageRecord.aggregate({
      where: { metric: "MESSAGES", periodStart: { gte: monthStart } },
      _sum: { value: true },
    });

    return {
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      monthlyRevenue,
      activeConversations,
      messagesThisMonth: messageUsage._sum.value ?? 0,
    };
  }

  async listOrganizations(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          subscriptions: {
            where: { status: { in: ["ACTIVE", "TRIALING"] } },
            include: { plan: true },
            take: 1,
          },
          _count: { select: { memberships: true, conversations: true } },
        },
      }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async suspendOrganization(organizationId: string, adminId: string) {
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: "SUSPENDED" },
    });

    await this.auditLogs.create({
      action: "ORGANIZATION_SUSPENDED",
      organizationId,
      platformAdminId: adminId,
    });

    return org;
  }

  async deleteOrganization(organizationId: string, adminId: string) {
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: "DELETED", deletedAt: new Date() },
    });

    await this.auditLogs.create({
      action: "ORGANIZATION_DELETED",
      organizationId,
      platformAdminId: adminId,
    });

    return org;
  }
}
