import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { PLATFORM_ADMIN_KEY } from "../decorators/auth.decorators";

@Injectable()
export class PlatformAdminGuard extends AuthGuard("platform-admin-jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPlatformAdmin = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isPlatformAdmin) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, admin: T): T {
    if (err || !admin) {
      throw err ?? new UnauthorizedException("Platform admin authentication required");
    }
    return admin;
  }
}
