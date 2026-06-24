import { Injectable } from "@nestjs/common";
import { ActivityType, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.module";

interface LogActivityInput {
  organizationId: string;
  type: ActivityType;
  title: string;
  description?: string;
  customerId?: string;
  conversationId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogActivityInput) {
    return this.prisma.activity.create({
      data: {
        organizationId: input.organizationId,
        type: input.type,
        title: input.title,
        description: input.description,
        customerId: input.customerId,
        conversationId: input.conversationId,
        userId: input.userId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listForCustomer(organizationId: string, customerId: string, page = 1, pageSize = 50) {
    const where = { organizationId, customerId, deletedAt: null };
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
