import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ROLES_KEY = "roles";
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const SKIP_TENANT_KEY = "skipTenant";
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);

export const PLATFORM_ADMIN_KEY = "platformAdmin";
export const PlatformAdminOnly = () => SetMetadata(PLATFORM_ADMIN_KEY, true);
