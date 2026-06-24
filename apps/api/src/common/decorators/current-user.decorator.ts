import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export interface RequestUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export interface RequestTenant {
  organizationId: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
  tenant?: RequestTenant;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestTenant => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenant!;
  },
);

export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.tenant!.organizationId;
  },
);
