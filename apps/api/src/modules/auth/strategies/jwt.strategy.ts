import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma/prisma.module";
import { JwtPayload } from "@mango/shared";
import { RequestUser } from "../../../common/decorators/current-user.decorator";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = config.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret";
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid token type");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: !!user.emailVerifiedAt,
    };
  }
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = config.get<string>("JWT_REFRESH_SECRET") ?? "dev-refresh-secret";
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  async validate(req: { body: { refreshToken: string } }, payload: JwtPayload) {
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return { user, refreshToken: req.body.refreshToken };
  }
}

@Injectable()
export class PlatformAdminJwtStrategy extends PassportStrategy(
  Strategy,
  "platform-admin-jwt",
) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = config.get<string>("JWT_ACCESS_SECRET") ?? "dev-access-secret";
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload & { admin?: boolean }) {
    if (!payload.admin) {
      throw new UnauthorizedException("Invalid admin token");
    }

    const admin = await this.prisma.platformAdmin.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });

    if (!admin) {
      throw new UnauthorizedException("Admin not found");
    }

    return { id: admin.id, email: admin.email, name: admin.name };
  }
}
