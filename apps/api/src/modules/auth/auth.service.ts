import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma/prisma.module";
import { MailService } from "../../common/mail/mail.module";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import {
  generateSecureToken,
  hashToken,
  slugify,
  addDays,
} from "../../common/utils/crypto.util";
import {
  SignupDto,
  LoginDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "./dto/auth.dto";
import { BRAND } from "../../config/branding";
import { AuthTokens } from "@mango/shared";
import { MembershipRole } from "@prisma/client";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private auditLogs: AuditLogsService,
  ) {}

  async signup(dto: SignupDto, ip?: string, userAgent?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let slug = slugify(dto.businessName);
    const slugExists = await this.prisma.organization.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const starterPlan = await this.prisma.plan.findFirst({
      where: { slug: "starter", isActive: true },
    });

    if (!starterPlan) {
      throw new BadRequestException("Starter plan not configured. Run database seed.");
    }

    const now = new Date();
    const trialEnd = addDays(now, 14);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.businessName,
          slug,
          country: dto.country ?? "BD",
          timezone: dto.timezone ?? "Asia/Dhaka",
          currency: dto.currency ?? "BDT",
        },
      });

      await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: MembershipRole.OWNER,
        },
      });

      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: starterPlan.id,
          status: "TRIALING",
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
        },
      });

      await tx.aiSettings.create({
        data: { organizationId: organization.id },
      });

      await tx.brainSettings.create({
        data: { organizationId: organization.id },
      });

      const verifyToken = generateSecureToken();
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(verifyToken),
          expiresAt: addDays(now, 1),
        },
      });

      return { user, organization, verifyToken };
    });

    const webUrl = this.config.get<string>("WEB_URL") ?? "http://localhost:3010";
    await this.mail.send({
      to: dto.email,
      subject: BRAND.emails.verifySubject,
      html: BRAND.emails.welcomeHtml(dto.name, `${webUrl}/auth/verify?token=${result.verifyToken}`),
    });

    await this.auditLogs.create({
      action: "SIGNUP",
      userId: result.user.id,
      organizationId: result.organization.id,
      ipAddress: ip,
      userAgent,
    });

    const tokens = await this.issueTokens(result.user.id, result.user.email);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        emailVerified: false,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true, deletedAt: null },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditLogs.create({
      action: "LOGIN",
      userId: user.id,
      ipAddress: ip,
      userAgent,
    });

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, isActive: true, deletedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            onboardingStep: true,
            onboardingCompletedAt: true,
          },
        },
      },
    });

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: !!user.emailVerifiedAt,
      },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logoUrl: m.organization.logoUrl,
        role: m.role,
        onboardingStep: m.organization.onboardingStep,
        onboardingCompleted: !!m.organization.onboardingCompletedAt,
      })),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string; type: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException("Refresh token revoked or expired");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.email);
  }

  async logout(userId: string, refreshToken?: string, ip?: string) {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditLogs.create({
      action: "LOGOUT",
      userId,
      ipAddress: ip,
    });

    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
    });

    if (!user) {
      return { success: true, message: "If the email exists, a reset link was sent" };
    }

    const token = generateSecureToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: addDays(new Date(), 1),
      },
    });

    const webUrl = this.config.get<string>("WEB_URL") ?? "http://localhost:3010";
    await this.mail.send({
      to: email,
      subject: BRAND.emails.resetPasswordSubject,
      html: BRAND.emails.resetPasswordHtml(`${webUrl}/auth/reset-password?token=${token}`),
    });

    return { success: true, message: "If the email exists, a reset link was sent" };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = hashToken(dto.token);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLogs.create({
      action: "PASSWORD_RESET",
      userId: record.userId,
    });

    return { success: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = hashToken(dto.token);
    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.auditLogs.create({
      action: "EMAIL_VERIFIED",
      userId: record.userId,
    });

    return { success: true };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
    });

    if (!user || user.emailVerifiedAt) {
      return { success: true };
    }

    const token = generateSecureToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: addDays(new Date(), 1),
      },
    });

    const webUrl = this.config.get<string>("WEB_URL") ?? "http://localhost:3010";
    await this.mail.send({
      to: email,
      subject: BRAND.emails.verifySubject,
      html: BRAND.emails.welcomeHtml(user.name ?? "there", `${webUrl}/auth/verify?token=${token}`),
    });

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          where: { isActive: true, deletedAt: null },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                onboardingStep: true,
                onboardingCompletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException("User not found");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt,
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        logoUrl: m.organization.logoUrl,
        role: m.role,
        onboardingStep: m.organization.onboardingStep,
        onboardingCompleted: !!m.organization.onboardingCompletedAt,
      })),
    };
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m";
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";

    const accessToken = this.jwt.sign(
      { sub: userId, email, type: "access" },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessExpiresIn as `${number}${"s" | "m" | "h" | "d"}`,
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: userId, email, type: "refresh", jti: randomUUID() },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshExpiresIn as `${number}${"s" | "m" | "h" | "d"}`,
      },
    );

    const expiresAt = addDays(new Date(), 7);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }
}
