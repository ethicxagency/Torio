import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.module";
import { MembershipRole } from "@prisma/client";

@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

  async getPermissionsForRole(role: MembershipRole) {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role },
      include: { permission: true },
    });
    return rolePermissions.map((rp) => rp.permission);
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({ orderBy: { module: "asc" } });
  }

  async userHasPermission(
    organizationId: string,
    userId: string,
    permissionKey: string,
  ): Promise<boolean> {
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId, isActive: true, deletedAt: null },
    });

    if (!membership) return false;

    const count = await this.prisma.rolePermission.count({
      where: {
        role: membership.role,
        permission: { key: permissionKey },
      },
    });

    return count > 0;
  }
}
