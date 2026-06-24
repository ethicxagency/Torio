import { Injectable } from "@nestjs/common";
import { AssignmentType, AutoAssignmentStrategy, MembershipRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async autoAssignConversation(organizationId: string, conversationId: string, customerId: string) {
    const settings = await this.prisma.organizationCrmSettings.findUnique({
      where: { organizationId },
    });

    if (!settings?.autoAssignmentEnabled || settings.autoAssignmentStrategy === AutoAssignmentStrategy.NONE) {
      return null;
    }

    const agents = await this.prisma.membership.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        role: { in: [MembershipRole.AGENT, MembershipRole.ADMIN] },
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!agents.length) return null;

    let selectedAgentId: string;

    if (settings.autoAssignmentStrategy === AutoAssignmentStrategy.LEAST_BUSY) {
      const counts = await Promise.all(
        agents.map(async (a) => ({
          userId: a.userId,
          count: await this.prisma.conversation.count({
            where: {
              organizationId,
              assignedAgentId: a.userId,
              status: "OPEN",
              deletedAt: null,
            },
          }),
        })),
      );
      counts.sort((a, b) => a.count - b.count);
      selectedAgentId = counts[0]!.userId;
    } else {
      const idx = settings.lastAssignedAgentId
        ? (agents.findIndex((a) => a.userId === settings.lastAssignedAgentId) + 1) % agents.length
        : 0;
      selectedAgentId = agents[idx]!.userId;
    }

    await this.prisma.conversationAssignment.updateMany({
      where: { conversationId, organizationId, isActive: true },
      data: { isActive: false, unassignedAt: new Date() },
    });

    await this.prisma.conversationAssignment.create({
      data: {
        organizationId,
        conversationId,
        assignedToId: selectedAgentId,
        assignedById: selectedAgentId,
        assignmentType: AssignmentType.AUTO,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedAgentId: selectedAgentId,
        assignedById: selectedAgentId,
        assignedAt: new Date(),
      },
    });

    await this.prisma.customer.updateMany({
      where: { id: customerId, organizationId, assignedAgentId: null },
      data: { assignedAgentId: selectedAgentId },
    });

    await this.prisma.organizationCrmSettings.update({
      where: { organizationId },
      data: { lastAssignedAgentId: selectedAgentId },
    });

    return selectedAgentId;
  }
}
