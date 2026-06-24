import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.module";
import {
  PERMISSIONS_KEY,
  ROLES_KEY,
  SKIP_TENANT_KEY,
  PLATFORM_ADMIN_KEY,
} from "../decorators/auth.decorators";
import { AuthenticatedRequest } from "../decorators/current-user.decorator";
import { ROLE_HIERARCHY, MembershipRole } from "@mango/shared";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const isPlatformAdmin = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTenant || isPlatformAdmin) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgId =
      (request.headers["x-organization-id"] as string) ??
      (request.query.organizationId as string);

    const needsTenant =
      !!orgId || !!requiredPermissions?.length || !!requiredRoles?.length;

    if (!needsTenant) return true;

    if (!orgId) {
      throw new BadRequestException("Organization context required (X-Organization-Id header)");
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId: orgId,
        userId: request.user.id,
        isActive: true,
        deletedAt: null,
        organization: { status: "ACTIVE", deletedAt: null },
      },
      include: {
        organization: { select: { id: true, name: true, slug: true, status: true } },
      },
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this organization");
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: membership.role },
      include: { permission: { select: { key: true } } },
    });

    request.tenant = {
      organizationId: membership.organizationId,
      role: membership.role,
      permissions: rolePermissions.map((rp) => rp.permission.key),
    };

    if (requiredRoles?.length) {
      const userLevel = ROLE_HIERARCHY[membership.role as MembershipRole] ?? 0;
      const minRequired = Math.min(
        ...requiredRoles.map((r) => ROLE_HIERARCHY[r as MembershipRole] ?? 0),
      );
      if (userLevel < minRequired) {
        throw new ForbiddenException("Insufficient role privileges");
      }
    }

    if (requiredPermissions?.length) {
      const hasAll = requiredPermissions.every((p) =>
        request.tenant!.permissions.includes(p),
      );
      if (!hasAll) {
        throw new ForbiddenException("Insufficient permissions");
      }
    }

    return true;
  }
}
