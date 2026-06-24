import { Injectable, BadRequestException } from "@nestjs/common";
import { OnboardingStep, KnowledgeSourceType } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";
import { MembershipsService } from "../memberships/memberships.service";
import {
  BusinessInfoStepDto,
  KnowledgeStepDto,
  InviteTeamStepDto,
} from "./dto/onboarding.dto";
import { MembershipRole } from "@prisma/client";

const STEP_ORDER: OnboardingStep[] = [
  OnboardingStep.BUSINESS_INFO,
  OnboardingStep.CONNECT_CHANNELS,
  OnboardingStep.KNOWLEDGE_BASE,
  OnboardingStep.INVITE_TEAM,
  OnboardingStep.COMPLETED,
];

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private memberships: MembershipsService,
  ) {}

  async getStatus(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        onboardingStep: true,
        onboardingCompletedAt: true,
        industry: true,
        website: true,
        facebookPage: true,
        channels: { where: { deletedAt: null }, select: { type: true, status: true } },
        knowledgeBases: {
          where: { deletedAt: null },
          include: { documents: { where: { deletedAt: null }, take: 5 } },
        },
      },
    });

    return org;
  }

  async saveBusinessInfo(organizationId: string, dto: BusinessInfoStepDto) {
    await this.advanceStep(organizationId, OnboardingStep.BUSINESS_INFO);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name,
        industry: dto.industry,
        website: dto.website,
        facebookPage: dto.facebookPage,
        onboardingStep: OnboardingStep.CONNECT_CHANNELS,
      },
    });
  }

  async completeChannelsStep(organizationId: string) {
    await this.advanceStep(organizationId, OnboardingStep.CONNECT_CHANNELS);

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingStep: OnboardingStep.KNOWLEDGE_BASE },
    });
  }

  async saveKnowledge(organizationId: string, dto: KnowledgeStepDto) {
    await this.advanceStep(organizationId, OnboardingStep.KNOWLEDGE_BASE);

    let kb = await this.prisma.knowledgeBase.findFirst({
      where: { organizationId, deletedAt: null },
    });

    if (!kb) {
      kb = await this.prisma.knowledgeBase.create({
        data: { organizationId, name: "Default Knowledge Base" },
      });
    }

    for (const item of dto.items) {
      await this.prisma.knowledgeDocument.create({
        data: {
          organizationId,
          knowledgeBaseId: kb.id,
          title: item.title,
          content: item.content,
          sourceType: KnowledgeSourceType.FAQ,
          status: "READY",
        },
      });
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { onboardingStep: OnboardingStep.INVITE_TEAM },
    });
  }

  async inviteTeam(
    organizationId: string,
    userId: string,
    dto: InviteTeamStepDto,
    role: MembershipRole,
  ) {
    await this.advanceStep(organizationId, OnboardingStep.INVITE_TEAM);

    for (const email of dto.emails) {
      await this.memberships.invite(
        organizationId,
        userId,
        { email, role: MembershipRole.AGENT },
        role,
      );
    }

    return this.complete(organizationId);
  }

  async complete(organizationId: string) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingStep: OnboardingStep.COMPLETED,
        onboardingCompletedAt: new Date(),
      },
    });
  }

  private async advanceStep(organizationId: string, expectedStep: OnboardingStep) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { onboardingStep: true },
    });

    if (!org) throw new BadRequestException("Organization not found");

    const currentIndex = STEP_ORDER.indexOf(org.onboardingStep);
    const expectedIndex = STEP_ORDER.indexOf(expectedStep);

    if (currentIndex > expectedIndex) return;
    if (currentIndex < expectedIndex - 1) {
      throw new BadRequestException(`Complete previous onboarding steps first`);
    }
  }
}
