import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { MembershipRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { MailService } from "../../common/mail/mail.module";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { generateSecureToken, hashToken, addDays } from "../../common/utils/crypto.util";
import { InviteMemberDto, UpdateMemberRoleDto } from "./dto/membership.dto";
import { ROLE_HIERARCHY, MembershipRole as SharedRole } from "@mango/shared";
import { BRAND } from "../../config/branding";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private auditLogs: AuditLogsService,
    private config: ConfigService,
  ) {}

  async listMembers(organizationId: string, includeInactive = false) {
    return this.prisma.membership.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true, lastLoginAt: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  async invite(
    organizationId: string,
    invitedById: string,
    dto: InviteMemberDto,
    inviterRole: MembershipRole,
  ) {
    if (dto.role === MembershipRole.OWNER && inviterRole !== MembershipRole.OWNER) {
      throw new ForbiddenException("Only owners can invite other owners");
    }

    const existingMember = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        user: { email: dto.email },
        deletedAt: null,
      },
    });

    if (existingMember?.isActive) {
      throw new ConflictException("User is already a team member");
    }

    const token = generateSecureToken();
    const invitation = await this.prisma.teamInvitation.create({
      data: {
        organizationId,
        email: dto.email,
        role: dto.role ?? MembershipRole.AGENT,
        tokenHash: hashToken(token),
        invitedById,
        expiresAt: addDays(new Date(), 7),
      },
      include: { organization: { select: { name: true } } },
    });

    const webUrl = this.config.get<string>("WEB_URL") ?? "http://localhost:3010";
    await this.mail.send({
      to: dto.email,
      subject: BRAND.emails.invitationSubject(invitation.organization.name),
      html: `<p>You've been invited to join ${invitation.organization.name} on ${BRAND.name}.</p><p><a href="${webUrl}/auth/accept-invite?token=${token}">Invitation to Join ${BRAND.name}</a></p>`,
    });

    await this.auditLogs.create({
      action: "TEAM_INVITED",
      organizationId,
      userId: invitedById,
      metadata: { email: dto.email, role: dto.role ?? MembershipRole.AGENT },
    });

    return { success: true, email: dto.email };
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    dto: UpdateMemberRoleDto,
    actorId: string,
    actorRole: MembershipRole,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId, deletedAt: null },
    });

    if (!membership) throw new NotFoundException("Member not found");

    if (membership.userId === actorId) {
      throw new BadRequestException("Cannot change your own role");
    }

    const actorLevel = ROLE_HIERARCHY[actorRole as SharedRole] ?? 0;
    const targetLevel = ROLE_HIERARCHY[membership.role as SharedRole] ?? 0;
    const newLevel = ROLE_HIERARCHY[dto.role as SharedRole] ?? 0;

    if (actorLevel <= targetLevel || actorLevel <= newLevel) {
      throw new ForbiddenException("Insufficient privileges to change this role");
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    await this.auditLogs.create({
      action: "ROLE_CHANGED",
      organizationId,
      userId: actorId,
      resource: "membership",
      resourceId: membershipId,
      metadata: { newRole: dto.role, memberId: membership.userId },
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    actorId: string,
    actorRole: MembershipRole,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId, deletedAt: null },
    });

    if (!membership) throw new NotFoundException("Member not found");

    if (membership.role === MembershipRole.OWNER) {
      const ownerCount = await this.prisma.membership.count({
        where: {
          organizationId,
          role: MembershipRole.OWNER,
          isActive: true,
          deletedAt: null,
        },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException("Cannot remove the last owner");
      }
    }

    const actorLevel = ROLE_HIERARCHY[actorRole as SharedRole] ?? 0;
    const targetLevel = ROLE_HIERARCHY[membership.role as SharedRole] ?? 0;

    if (membership.userId !== actorId && actorLevel <= targetLevel) {
      throw new ForbiddenException("Insufficient privileges");
    }

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.auditLogs.create({
      action: "TEAM_REMOVED",
      organizationId,
      userId: actorId,
      metadata: { removedMemberId: membership.userId },
    });

    return { success: true };
  }

  async suspendMember(
    organizationId: string,
    membershipId: string,
    actorId: string,
    actorRole: MembershipRole,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId, deletedAt: null, isActive: true },
    });
    if (!membership) throw new NotFoundException("Member not found");
    if (membership.userId === actorId) throw new BadRequestException("Cannot suspend yourself");

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { isActive: false },
    });

    return { success: true };
  }

  async reactivateMember(organizationId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId, deletedAt: null },
    });
    if (!membership) throw new NotFoundException("Member not found");

    return this.prisma.membership.update({
      where: { id: membershipId },
      data: { isActive: true, deletedAt: null },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async listInvitations(organizationId: string) {
    return this.prisma.teamInvitation.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
    });
  }
}
